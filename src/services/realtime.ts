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
  wifiLoading: boolean;
  wifiError: string | null;
  searchResults: PeerInfo[];
  searchingPeers: boolean;
  searchError: string | null;
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

export interface RealtimeProfilePayload {
  privateCode: string;
  name: string;
  avatarId: string;
  levelId: CEFRLevelId;
  xp?: number;
  streak?: number;
  completedLessons?: number;
  avgSkill?: number;
  unlockedLevels?: CEFRLevelId[];
  lanServerUrl?: string;
}

type Listener = (state: RealtimeState) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private webrtcSignalHandlers = new Set<(fromCode: string, signal: unknown) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private retryDelay = 1200;
  private shouldRun = false;
  private lastProfile: RealtimeProfilePayload | null = null;

  private state: RealtimeState = {
    connected: false,
    reconnecting: false,
    registeredCode: null,
    codeConflictError: null,
    wifiPeers: [],
    wifiLoading: false,
    wifiError: null,
    searchResults: [],
    searchingPeers: false,
    searchError: null,
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

  private resolveHttpBase(lanServerUrl?: string): string {
    const custom = (lanServerUrl || '').trim();
    if (custom) {
      if (custom.startsWith('http://') || custom.startsWith('https://')) {
        return custom.replace(/\/ws$/, '').replace(/\/$/, '');
      }
      if (custom.startsWith('ws://') || custom.startsWith('wss://')) {
        return custom.replace(/^ws/, 'http').replace(/\/ws$/, '').replace(/\/$/, '');
      }
      return `http://${custom.replace(/\/$/, '')}`;
    }
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
      return '';
    }
    return window.location.origin;
  }

  public connect(profile: RealtimeProfilePayload) {
    const urlChanged = this.lastProfile?.lanServerUrl !== profile.lanServerUrl;
    const statsOrIdentityChanged =
      this.lastProfile?.privateCode !== profile.privateCode ||
      this.lastProfile?.name !== profile.name ||
      this.lastProfile?.avatarId !== profile.avatarId ||
      this.lastProfile?.levelId !== profile.levelId ||
      this.lastProfile?.xp !== profile.xp ||
      this.lastProfile?.streak !== profile.streak ||
      this.lastProfile?.completedLessons !== profile.completedLessons;

    this.lastProfile = profile;
    this.shouldRun = true;
    this.ensureHeartbeat();

    if (this.ws && this.ws.readyState === WebSocket.OPEN && !urlChanged) {
      if (
        statsOrIdentityChanged ||
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

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.openSocket();
    }
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.shouldRun || !this.lastProfile) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        void this.sendHttpHeartbeat(true);
      }
    }, 6000);
  }

  private async sendHttpHeartbeat(httpOnly: boolean) {
    if (!this.lastProfile) return;
    const base = this.resolveHttpBase(this.lastProfile.lanServerUrl);
    if (!base) return;
    try {
      const res = await fetch(`${base}/api/peers/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.lastProfile, httpOnly }),
      });
      if (res.status === 409) {
        const data = (await res.json()) as { error?: string };
        this.setState({
          registeredCode: null,
          codeConflictError: data.error || 'تعارض في الرقم الخاص على الشبكة',
        });
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { events?: Array<Record<string, unknown>> };
      if (!this.state.connected && !this.state.registeredCode) {
        this.setState({ registeredCode: this.lastProfile.privateCode, codeConflictError: null });
      }
      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          this.handleMessage(ev);
        }
      }
    } catch {
      // Offline / unreachable server
    }
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
            ...this.lastProfile,
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
        if (this.ws === ws) this.ws = null;
        this.setState({ connected: false, reconnecting: this.shouldRun });
        void this.sendHttpHeartbeat(false);
        if (this.shouldRun) {
          this.reconnectTimer = setTimeout(() => {
            this.retryDelay = Math.min(8000, Math.round(this.retryDelay * 1.5));
            this.openSocket();
          }, this.retryDelay);
        }
      };

      ws.onerror = () => {
        // Fallback heartbeat handles discovery while WS retries
        void this.sendHttpHeartbeat(false);
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
      this.setState({
        wifiPeers: (msg.peers as PeerInfo[]) || [],
        wifiLoading: false,
        wifiError: null,
      });
      return;
    }
    if (type === 'peers:search_result') {
      this.setState({
        searchResults: (msg.peers as PeerInfo[]) || [],
        searchingPeers: false,
        searchError: null,
      });
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

  public send(payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  public async discoverWifi() {
    this.setState({ wifiLoading: true, wifiError: null });
    const sent = this.send({ type: 'discover_wifi' });
    const base = this.resolveHttpBase(this.lastProfile?.lanServerUrl);
    if (!base) {
      if (!sent) {
        this.setState({
          wifiLoading: false,
          wifiError: 'أدخل عنوان خادم الواي فاي المحلي (مثل 192.168.1.10:3000) للبحث على الشبكة.',
        });
      }
      return;
    }
    try {
      await this.sendHttpHeartbeat(false);
      const self = encodeURIComponent(this.lastProfile?.privateCode || '');
      const res = await fetch(`${base}/api/peers/wifi?self=${self}`);
      if (res.ok) {
        const data = (await res.json()) as { peers?: PeerInfo[] };
        this.setState({
          wifiPeers: data.peers || [],
          wifiLoading: false,
          wifiError: null,
        });
        return;
      }
    } catch {
      if (!sent) {
        this.setState({
          wifiLoading: false,
          wifiError: 'تعذر الوصول لخادم الشبكة المحلية الآن. تأكد من الاتصال بالواي فاي أو أعد المحاولة.',
        });
      }
    }
  }

  public async searchPeers(query: string, scope: 'wifi' | 'online' | 'all' = 'all') {
    this.setState({ searchingPeers: true, searchError: null });
    this.send({ type: 'search_peers', query, scope });
    const base = this.resolveHttpBase(this.lastProfile?.lanServerUrl);
    if (!base) {
      this.setState({
        searchingPeers: false,
        searchError: 'تعذر الاتصال بالخادم للبحث.',
      });
      return;
    }
    try {
      await this.sendHttpHeartbeat(false);
      const params = new URLSearchParams({
        q: query.trim(),
        scope,
        self: this.lastProfile?.privateCode || '',
      });
      const res = await fetch(`${base}/api/peers/search?${params.toString()}`);
      if (!res.ok) throw new Error('search failed');
      const data = (await res.json()) as { peers?: PeerInfo[] };
      this.setState({
        searchResults: data.peers || [],
        searchingPeers: false,
        searchError: null,
      });
    } catch {
      this.setState({
        searchingPeers: false,
        searchError: 'تعذر إتمام البحث عن الأصدقاء الآن. تحقق من الاتصال.',
      });
    }
  }

  public async lookupPeer(targetCode: string): Promise<PeerInfo | null> {
    const clean = targetCode.trim();
    this.setState({ lookupError: null, lookedUpPeer: null });
    this.send({ type: 'lookup_peer', targetCode: clean });
    const base = this.resolveHttpBase(this.lastProfile?.lanServerUrl);
    if (!base) return null;
    try {
      const self = encodeURIComponent(this.lastProfile?.privateCode || '');
      const res = await fetch(`${base}/api/peers/lookup/${encodeURIComponent(clean)}?self=${self}`);
      const data = (await res.json()) as { peer?: PeerInfo; error?: string };
      if (!res.ok || data.error) {
        this.setState({ lookupError: data.error || 'تعذر التحقق من الرقم', lookedUpPeer: null });
        return null;
      }
      if (data.peer) {
        this.setState({ lookedUpPeer: data.peer, lookupError: null });
        return data.peer;
      }
    } catch {
      // Ignore if offline
    }
    return null;
  }

  public async sendChallenge(toCode: string, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ challengeNotice: null });
    const sent = this.send({
      type: 'challenge:send',
      toCode,
      mode,
      useTimer,
      timerSeconds: 15,
    });
    if (sent) return;

    const base = this.resolveHttpBase(this.lastProfile?.lanServerUrl);
    if (!base || !this.lastProfile) {
      this.setState({ challengeNotice: 'غير متصل بالخادم حالياً — تأكد من الشبكة وأعد المحاولة.' });
      return;
    }
    try {
      await this.sendHttpHeartbeat(false);
      const res = await fetch(`${base}/api/challenges/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCode: this.lastProfile.privateCode,
          toCode,
          mode,
          useTimer,
          timerSeconds: 15,
        }),
      });
      const data = (await res.json()) as { invite?: ChallengeInvite; error?: string };
      if (!res.ok || data.error) {
        this.setState({ challengeNotice: data.error || 'تعذر إرسال طلب التحدي.' });
        return;
      }
      if (data.invite) {
        this.setState({ outgoingInvite: data.invite, challengeNotice: null });
      }
    } catch {
      this.setState({ challengeNotice: 'تعذر إرسال التحدي — تأكد من الاتصال بالخادم.' });
    }
  }

  public respondToChallenge(inviteId: string, accept: boolean) {
    this.setState({ incomingInvite: null });
    const sent = this.send({ type: 'challenge:respond', inviteId, accept });
    if (!sent) {
      this.setState({ challengeNotice: 'انتظر إعادة الاتصال بالخادم لإتمام التحدي.' });
    }
  }

  public createTeam(teamName: string, format: TeamFormat, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ teamNotice: null, messages: [] });
    const sent = this.send({ type: 'team:create', teamName, format, mode, useTimer });
    if (!sent) {
      this.setState({ teamNotice: 'جاري الاتصال بالخادم الفوري، حاول بعد لحظة.' });
    }
  }

  public requestJoinTeam(codeOrLeader: string, side: 'A' | 'B' = 'A') {
    this.setState({ teamNotice: null });
    const sent = this.send({ type: 'team:join_request', codeOrLeader, side });
    if (!sent) {
      this.setState({ teamNotice: 'تعذر إرسال طلب الانضمام — تأكد من الاتصال بالخادم.' });
    }
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
    this.setState({
      challengeNotice: null,
      teamNotice: null,
      lookupError: null,
      wifiError: null,
      searchError: null,
    });
  }
}

export const realtimeClient = new RealtimeClient();
