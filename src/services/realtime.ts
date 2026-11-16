import type {
  CEFRLevelId,
  ChallengeInvite,
  ChatChannel,
  ChatMessage,
  ConnectionMode,
  PeerInfo,
  TeamFormat,
  TeamRoomState,
} from '../types';

export interface RealtimeState {
  connected: boolean;
  reconnecting: boolean;
  registeredCode: string | null;
  codeConflictError: string | null;
  wifiPeers: PeerInfo[];
  lookedUpPeer: PeerInfo | null;
  lookupError: string | null;
  outgoingInvite: ChallengeInvite | null;
  incomingInvite: ChallengeInvite | null;
  challengeNotice: string | null;
  teamNotice: string | null;
  room: TeamRoomState | null;
  messages: ChatMessage[];
  speakingPeers: Record<string, boolean>;
  chatClosedMessage: string | null;
}

type Listener = (state: RealtimeState) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private webrtcSignalHandlers = new Set<(fromCode: string, signal: unknown) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1200;
  private shouldRun = false;
  private lastProfile: {
    privateCode: string;
    name: string;
    avatarId: string;
    levelId: CEFRLevelId;
    lanServerUrl?: string;
  } | null = null;

  private state: RealtimeState = {
    connected: false,
    reconnecting: false,
    registeredCode: null,
    codeConflictError: null,
    wifiPeers: [],
    lookedUpPeer: null,
    lookupError: null,
    outgoingInvite: null,
    incomingInvite: null,
    challengeNotice: null,
    teamNotice: null,
    room: null,
    messages: [],
    speakingPeers: {},
    chatClosedMessage: null,
  };

  private emit() {
    const snap: RealtimeState = { ...this.state };
    for (const fn of this.listeners) fn(snap);
  }

  private setState(partial: Partial<RealtimeState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({ ...this.state });
    return () => {
      this.listeners.delete(fn);
    };
  }

  public onWebRTCSignal(fn: (fromCode: string, signal: unknown) => void): () => void {
    this.webrtcSignalHandlers.add(fn);
    return () => {
      this.webrtcSignalHandlers.delete(fn);
    };
  }

  public getSnapshot(): RealtimeState {
    return { ...this.state };
  }

  private resolveWsUrl(lanServerUrl?: string): string {
    const custom = (lanServerUrl || '').trim();
    if (custom) {
      if (custom.startsWith('ws://') || custom.startsWith('wss://')) {
        return custom.endsWith('/ws') ? custom : `${custom.replace(/\/$/, '')}/ws`;
      }
      if (custom.startsWith('http://') || custom.startsWith('https://')) {
        return `${custom.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;
      }
      return `ws://${custom.replace(/\/$/, '')}/ws`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  public connect(profile: {
    privateCode: string;
    name: string;
    avatarId: string;
    levelId: CEFRLevelId;
    lanServerUrl?: string;
  }) {
    const urlChanged = this.lastProfile?.lanServerUrl !== profile.lanServerUrl;
    const codeChanged = this.lastProfile?.privateCode !== profile.privateCode;
    this.lastProfile = profile;
    this.shouldRun = true;

    if (this.ws && this.ws.readyState === WebSocket.OPEN && !urlChanged) {
      if (
        codeChanged ||
        this.state.registeredCode !== profile.privateCode ||
        this.state.codeConflictError
      ) {
        this.send({
          type: 'register',
          ...profile,
        });
      }
      return;
    }

    if (urlChanged && this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    this.openSocket();
  }

  private openSocket() {
    if (!this.shouldRun || !this.lastProfile) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const url = this.resolveWsUrl(this.lastProfile.lanServerUrl);
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.retryDelay = 1200;
        this.setState({ connected: true, reconnecting: false });
        if (this.lastProfile) {
          this.send({
            type: 'register',
            privateCode: this.lastProfile.privateCode,
            name: this.lastProfile.name,
            avatarId: this.lastProfile.avatarId,
            levelId: this.lastProfile.levelId,
          });
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          this.handleMessage(msg);
        } catch {
          // Ignore malformed JSON
        }
      };

      ws.onclose = () => {
        this.setState({ connected: false, reconnecting: this.shouldRun });
        if (this.shouldRun) {
          this.reconnectTimer = setTimeout(() => {
            this.retryDelay = Math.min(8000, Math.round(this.retryDelay * 1.5));
            this.openSocket();
          }, this.retryDelay);
        }
      };

      ws.onerror = () => {
        // Handled in onclose
      };
    } catch {
      this.setState({ connected: false, reconnecting: this.shouldRun });
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    const type = String(msg.type || '');

    if (type === 'register:ok') {
      this.setState({
        registeredCode: String(msg.privateCode || ''),
        codeConflictError: null,
      });
      return;
    }
    if (type === 'register:error') {
      this.setState({
        registeredCode: null,
        codeConflictError: String(msg.message || 'خطأ في تسجيل الرقم الخاص'),
      });
      return;
    }
    if (type === 'wifi:peers') {
      this.setState({ wifiPeers: (msg.peers as PeerInfo[]) || [] });
      return;
    }
    if (type === 'peer:status') {
      if (msg.error) {
        this.setState({ lookedUpPeer: null, lookupError: String(msg.error) });
      } else {
        this.setState({ lookedUpPeer: (msg.peer as PeerInfo) || null, lookupError: null });
      }
      return;
    }
    if (type === 'challenge:sent') {
      this.setState({
        outgoingInvite: (msg.invite as ChallengeInvite) || null,
        challengeNotice: null,
      });
      return;
    }
    if (type === 'challenge:incoming') {
      this.setState({ incomingInvite: (msg.invite as ChallengeInvite) || null });
      return;
    }
    if (type === 'challenge:declined' || type === 'challenge:expired' || type === 'challenge:error') {
      const text = String(msg.message || '');
      this.setState({
        outgoingInvite: null,
        incomingInvite:
          this.state.incomingInvite?.inviteId === msg.inviteId ? null : this.state.incomingInvite,
        challengeNotice: text,
      });
      return;
    }
    if (type === 'team:error' || type === 'team:notice') {
      this.setState({ teamNotice: String(msg.message || '') });
      return;
    }
    if (type === 'room:state') {
      const room = (msg.room as TeamRoomState) || null;
      this.setState({
        room,
        outgoingInvite: null,
        incomingInvite: null,
        challengeNotice: null,
        chatClosedMessage: null,
      });
      return;
    }
    if (type === 'room:player_left') {
      this.setState({
        teamNotice: String(msg.message || 'غادر صديقك اللعبة'),
      });
      return;
    }
    if (type === 'chat:history') {
      this.setState({ messages: (msg.messages as ChatMessage[]) || [] });
      return;
    }
    if (type === 'chat:message') {
      const m = msg.message as ChatMessage;
      if (!m) return;
      if (this.state.messages.some((x) => x.id === m.id)) return;
      this.setState({ messages: [...this.state.messages, m].slice(-50) });
      return;
    }
    if (type === 'chat:cleared') {
      this.setState({ messages: [] });
      return;
    }
    if (type === 'chat:closed') {
      this.setState({ chatClosedMessage: String(msg.message || '') });
      return;
    }
    if (type === 'voice:speaking') {
      const fromCode = String(msg.fromCode || '');
      const speaking = Boolean(msg.speaking);
      this.setState({
        speakingPeers: { ...this.state.speakingPeers, [fromCode]: speaking },
      });
      return;
    }
    if (type === 'webrtc:signal') {
      const fromCode = String(msg.fromCode || '');
      for (const h of this.webrtcSignalHandlers) {
        h(fromCode, msg.signal);
      }
    }
  }

  public send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  public discoverWifi() {
    this.send({ type: 'discover_wifi' });
  }

  public lookupPeer(targetCode: string) {
    this.setState({ lookupError: null, lookedUpPeer: null });
    this.send({ type: 'lookup_peer', targetCode });
  }

  public sendChallenge(toCode: string, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ challengeNotice: null });
    this.send({
      type: 'challenge:send',
      toCode,
      mode,
      useTimer,
      timerSeconds: 15,
    });
  }

  public respondToChallenge(inviteId: string, accept: boolean) {
    this.setState({ incomingInvite: null });
    this.send({ type: 'challenge:respond', inviteId, accept });
  }

  public createTeam(teamName: string, format: TeamFormat, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ teamNotice: null, messages: [] });
    this.send({ type: 'team:create', teamName, format, mode, useTimer });
  }

  public requestJoinTeam(codeOrLeader: string, side: 'A' | 'B' = 'A') {
    this.setState({ teamNotice: null });
    this.send({ type: 'team:join_request', codeOrLeader, side });
  }

  public approveJoinRequest(requestId: string, approve: boolean, side?: 'A' | 'B') {
    this.send({ type: 'team:approve_join', requestId, approve, side });
  }

  public switchSide(targetCode?: string) {
    this.send({ type: 'team:switch_side', targetCode });
  }

  public setTeamTimer(useTimer: boolean) {
    this.send({ type: 'team:set_timer', useTimer });
  }

  public startTeamGame() {
    this.send({ type: 'team:start' });
  }

  public playAgain() {
    this.send({ type: 'team:play_again' });
  }

  public leaveRoom() {
    this.send({ type: 'team:leave' });
    this.setState({ room: null, messages: [], speakingPeers: {}, teamNotice: null });
  }

  public submitGameAnswer(isCorrect: boolean, answeredCount: number) {
    this.send({ type: 'game:answer', isCorrect, answeredCount });
  }

  public sendChatMessage(text: string, channel: ChatChannel, recipientCode?: string) {
    this.send({ type: 'chat:send', text, channel, recipientCode });
  }

  public clearChat() {
    this.send({ type: 'chat:clear' });
  }

  public clearNotices() {
    this.setState({ challengeNotice: null, teamNotice: null, lookupError: null });
  }
}

export const realtimeClient = new RealtimeClient();
