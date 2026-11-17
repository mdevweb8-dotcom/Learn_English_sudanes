import { Capacitor } from '@capacitor/core';
import type {
  CEFRLevelId,
  ChallengeInvite,
  ChatChannel,
  ChatMessage,
  ConnectionMode,
  DiscoveredWifiHost,
  PeerInfo,
  TeamFormat,
  TeamRoomState,
  WifiHostStatus,
} from '../types';
import {
  addWifiHostStatusListener,
  addWifiHostsListener,
  getDiscoveredWifiHostsNative,
  getWifiHostStatusNative,
  isNativeAndroidWifiSupported,
  startWifiDiscoveryNative,
  startWifiHostNative,
  stopWifiDiscoveryNative,
  stopWifiHostNative,
} from './wifiPlugin';

export interface RealtimeState {
  // Online channel status
  connected: boolean;
  reconnecting: boolean;
  registeredCode: string | null;
  codeConflictError: string | null;

  // Wi-Fi offline channel status (strictly separated)
  wifiNativeSupported: boolean;
  wifiConnected: boolean;
  wifiRegisteredCode: string | null;
  wifiActiveHostUrl: string;
  wifiHostStatus: WifiHostStatus;
  wifiDiscoveredHosts: DiscoveredWifiHost[];
  wifiPeers: PeerInfo[];
  wifiLoading: boolean;
  wifiError: string | null;

  // Search & Lookup
  searchResults: PeerInfo[];
  searchingPeers: boolean;
  searchError: string | null;
  lookedUpPeer: PeerInfo | null;
  lookupError: string | null;

  // Invites, Room, Chat & Voice
  activeTransport: ConnectionMode;
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

const FALLBACK_ONLINE_ORIGIN = 'https://ais-dev-zespku4f3kmmc2hr4ikvlg-999469107205.europe-west2.run.app';

interface EndpointConfig {
  httpUrl: string;
  wsUrl: string;
}

class RealtimeClient {
  // Strictly separated Online socket & state
  private onlineWs: WebSocket | null = null;
  private onlineReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private onlineRetryDelay = 1500;
  private onlineSessionToken = '';

  // Strictly separated Offline Wi-Fi LAN socket & state
  private wifiWs: WebSocket | null = null;
  private wifiEndpoint: EndpointConfig | null = null;
  private wifiReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wifiHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private wifiRetryDelay = 1200;
  private wifiSessionToken = '';

  private listeners = new Set<Listener>();
  private webrtcSignalHandlers = new Set<(fromCode: string, signal: unknown) => void>();
  private shouldRun = false;
  private lastProfile: RealtimeProfilePayload | null = null;
  private nativeListenersAttached = false;

  private state: RealtimeState = {
    connected: false,
    reconnecting: false,
    registeredCode: null,
    codeConflictError: null,

    wifiNativeSupported: isNativeAndroidWifiSupported(),
    wifiConnected: false,
    wifiRegisteredCode: null,
    wifiActiveHostUrl: '',
    wifiHostStatus: {
      active: false,
      ip: '',
      httpPort: 0,
      wsPort: 0,
      httpUrl: '',
      wsUrl: '',
      connectedCount: 0,
      serviceName: '',
    },
    wifiDiscoveredHosts: [],
    wifiPeers: [],
    wifiLoading: false,
    wifiError: null,

    searchResults: [],
    searchingPeers: false,
    searchError: null,
    lookedUpPeer: null,
    lookupError: null,

    activeTransport: 'online',
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

  private parseEndpoint(input: string): EndpointConfig | null {
    const clean = input.trim().replace(/\/$/, '');
    if (!clean) return null;

    let httpUrl = clean;
    if (clean.startsWith('ws://') || clean.startsWith('wss://')) {
      httpUrl = clean.replace(/^ws/, 'http').replace(/\/ws$/, '');
    } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      httpUrl = `http://${clean}`;
    }

    // Extract port to detect Android native host (httpPort -> wsPort = httpPort + 1) vs standard /ws server
    let wsUrl: string;
    try {
      const parsed = new URL(httpUrl);
      const isHttps = parsed.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const portNum = parsed.port ? Number(parsed.port) : 0;
      if (portNum >= 38420 && portNum <= 38440) {
        wsUrl = `${wsProto}//${parsed.hostname}:${portNum + 1}`;
      } else {
        wsUrl = `${wsProto}//${parsed.host}/ws`;
      }
      return { httpUrl: `${parsed.protocol}//${parsed.host}`, wsUrl };
    } catch {
      return null;
    }
  }

  private resolveOnlineEndpoint(): EndpointConfig | null {
    if (typeof window === 'undefined') return null;

    const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ONLINE_SERVER_URL;
    const isCapacitorNative = Capacitor.isNativePlatform();
    const isLocalOrigin =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' && isCapacitorNative;

    if (isCapacitorNative || isLocalOrigin) {
      return this.parseEndpoint(envUrl || FALLBACK_ONLINE_ORIGIN);
    }

    const origin = window.location.origin;
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
      httpUrl: origin,
      wsUrl: `${wsProto}//${window.location.host}/ws`,
    };
  }

  private resolveWifiEndpoint(customLanUrl?: string): EndpointConfig | null {
    if (this.state.wifiHostStatus.active && this.state.wifiHostStatus.httpUrl) {
      return {
        httpUrl: this.state.wifiHostStatus.httpUrl,
        wsUrl: this.state.wifiHostStatus.wsUrl,
      };
    }
    if (this.wifiEndpoint) {
      return this.wifiEndpoint;
    }
    const manual = (customLanUrl || '').trim();
    if (manual) {
      return this.parseEndpoint(manual);
    }
    // On Web/PWA dev or self-hosted LAN server (non-native Android), current origin might be the LAN server
    if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && !host.endsWith('.run.app')) {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return {
          httpUrl: window.location.origin,
          wsUrl: `${wsProto}//${window.location.host}/ws`,
        };
      }
    }
    return null;
  }

  private async attachNativeListeners() {
    if (this.nativeListenersAttached || !isNativeAndroidWifiSupported()) return;
    this.nativeListenersAttached = true;

    await addWifiHostsListener((hosts) => {
      this.handleNativeDiscoveredHosts(hosts);
    });
    await addWifiHostStatusListener((status) => {
      this.setState({ wifiHostStatus: status });
      if (status.active && status.httpUrl) {
        this.connectWifiEndpoint({ httpUrl: status.httpUrl, wsUrl: status.wsUrl });
      }
    });

    try {
      const status = await getWifiHostStatusNative();
      if (status.active) {
        this.setState({ wifiHostStatus: status });
        this.connectWifiEndpoint({ httpUrl: status.httpUrl, wsUrl: status.wsUrl });
      }
    } catch {
      // Ignore
    }
  }

  private handleNativeDiscoveredHosts(hosts: DiscoveredWifiHost[]) {
    const filtered = hosts.filter((h) => h.privateCode !== this.lastProfile?.privateCode);
    this.setState({
      wifiDiscoveredHosts: filtered,
      wifiLoading: false,
      wifiError: null,
    });

    // Auto-connect client to the first discovered local host if not already hosting/connected
    if (!this.state.wifiHostStatus.active && !this.wifiEndpoint && filtered.length > 0) {
      const target = filtered[0];
      this.connectWifiEndpoint({ httpUrl: target.httpUrl, wsUrl: target.wsUrl });
    }
  }

  public connect(profile: RealtimeProfilePayload) {
    const lanChanged = this.lastProfile?.lanServerUrl !== profile.lanServerUrl;
    const identityChanged =
      this.lastProfile?.privateCode !== profile.privateCode ||
      this.lastProfile?.name !== profile.name ||
      this.lastProfile?.avatarId !== profile.avatarId ||
      this.lastProfile?.levelId !== profile.levelId ||
      this.lastProfile?.xp !== profile.xp ||
      this.lastProfile?.streak !== profile.streak ||
      this.lastProfile?.completedLessons !== profile.completedLessons;

    this.lastProfile = profile;
    this.shouldRun = true;
    void this.attachNativeListeners();

    // 1. Online Transport
    this.ensureOnlineHeartbeat();
    if (this.onlineWs && this.onlineWs.readyState === WebSocket.OPEN) {
      if (identityChanged || this.state.registeredCode !== profile.privateCode || this.state.codeConflictError) {
        this.sendToChannel('online', {
          type: 'register',
          ...profile,
          sessionToken: this.onlineSessionToken || undefined,
        });
      }
    } else if (!this.onlineWs || this.onlineWs.readyState === WebSocket.CLOSED) {
      this.openOnlineSocket();
    }

    // 2. Wi-Fi Transport (only if manual LAN URL or active host/discovered endpoint exists)
    if (lanChanged) {
      if (profile.lanServerUrl?.trim()) {
        const parsed = this.parseEndpoint(profile.lanServerUrl);
        if (parsed) this.connectWifiEndpoint(parsed);
      } else if (!this.state.wifiHostStatus.active) {
        this.disconnectWifiEndpoint();
      }
    } else if (this.wifiWs && this.wifiWs.readyState === WebSocket.OPEN && identityChanged) {
      this.sendToChannel('wifi', {
        type: 'register',
        ...profile,
        sessionToken: this.wifiSessionToken || undefined,
      });
    } else if (profile.lanServerUrl?.trim() && (!this.wifiWs || this.wifiWs.readyState === WebSocket.CLOSED)) {
      const parsed = this.parseEndpoint(profile.lanServerUrl);
      if (parsed) this.connectWifiEndpoint(parsed);
    }
  }

  // ==================== ONLINE CHANNEL ====================
  private ensureOnlineHeartbeat() {
    if (this.onlineHeartbeatTimer) return;
    this.onlineHeartbeatTimer = setInterval(() => {
      if (!this.shouldRun || !this.lastProfile) return;
      if (!this.onlineWs || this.onlineWs.readyState !== WebSocket.OPEN) {
        void this.sendHttpHeartbeat('online', true);
      }
    }, 6500);
  }

  private openOnlineSocket() {
    if (!this.shouldRun || !this.lastProfile) return;
    if (this.onlineReconnectTimer) {
      clearTimeout(this.onlineReconnectTimer);
      this.onlineReconnectTimer = null;
    }
    const ep = this.resolveOnlineEndpoint();
    if (!ep) return;

    try {
      const ws = new WebSocket(ep.wsUrl);
      this.onlineWs = ws;

      ws.onopen = () => {
        this.onlineRetryDelay = 1500;
        this.setState({ connected: true, reconnecting: false });
        if (this.lastProfile) {
          this.sendToChannel('online', {
            type: 'register',
            ...this.lastProfile,
            sessionToken: this.onlineSessionToken || undefined,
          });
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          this.handleChannelMessage('online', msg);
        } catch {
          // Ignore malformed JSON
        }
      };

      ws.onclose = () => {
        if (this.onlineWs === ws) this.onlineWs = null;
        this.setState({ connected: false, reconnecting: this.shouldRun });
        void this.sendHttpHeartbeat('online', false);
        if (this.shouldRun) {
          this.onlineReconnectTimer = setTimeout(() => {
            this.onlineRetryDelay = Math.min(10000, Math.round(this.onlineRetryDelay * 1.5));
            this.openOnlineSocket();
          }, this.onlineRetryDelay);
        }
      };

      ws.onerror = () => {
        void this.sendHttpHeartbeat('online', false);
      };
    } catch {
      this.setState({ connected: false, reconnecting: this.shouldRun });
    }
  }

  // ==================== WI-FI OFFLINE CHANNEL ====================
  public connectWifiEndpoint(endpoint: EndpointConfig) {
    const same =
      this.wifiEndpoint?.httpUrl === endpoint.httpUrl && this.wifiEndpoint?.wsUrl === endpoint.wsUrl;
    if (same && this.wifiWs && (this.wifiWs.readyState === WebSocket.OPEN || this.wifiWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.disconnectWifiEndpoint();
    this.wifiEndpoint = endpoint;
    this.setState({ wifiActiveHostUrl: endpoint.httpUrl, wifiError: null });
    this.ensureWifiHeartbeat();
    this.openWifiSocket();
  }

  public disconnectWifiEndpoint() {
    if (this.wifiReconnectTimer) {
      clearTimeout(this.wifiReconnectTimer);
      this.wifiReconnectTimer = null;
    }
    if (this.wifiHeartbeatTimer) {
      clearInterval(this.wifiHeartbeatTimer);
      this.wifiHeartbeatTimer = null;
    }
    if (this.wifiWs) {
      try {
        this.wifiWs.close();
      } catch {
        // Ignore
      }
      this.wifiWs = null;
    }
    this.wifiEndpoint = null;
    this.wifiSessionToken = '';
    this.setState({
      wifiConnected: false,
      wifiRegisteredCode: null,
      wifiActiveHostUrl: '',
      wifiPeers: [],
    });
  }

  private ensureWifiHeartbeat() {
    if (this.wifiHeartbeatTimer) return;
    this.wifiHeartbeatTimer = setInterval(() => {
      if (!this.shouldRun || !this.lastProfile || !this.wifiEndpoint) return;
      if (!this.wifiWs || this.wifiWs.readyState !== WebSocket.OPEN) {
        void this.sendHttpHeartbeat('wifi', true);
      }
    }, 3500);
  }

  private openWifiSocket() {
    if (!this.shouldRun || !this.lastProfile || !this.wifiEndpoint) return;
    if (this.wifiReconnectTimer) {
      clearTimeout(this.wifiReconnectTimer);
      this.wifiReconnectTimer = null;
    }
    const targetWsUrl = this.wifiEndpoint.wsUrl;
    try {
      const ws = new WebSocket(targetWsUrl);
      this.wifiWs = ws;

      ws.onopen = () => {
        this.wifiRetryDelay = 1000;
        this.setState({ wifiConnected: true, wifiError: null });
        if (this.lastProfile) {
          this.sendToChannel('wifi', {
            type: 'register',
            ...this.lastProfile,
            sessionToken: this.wifiSessionToken || undefined,
          });
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          this.handleChannelMessage('wifi', msg);
        } catch {
          // Ignore malformed JSON
        }
      };

      ws.onclose = () => {
        if (this.wifiWs === ws) this.wifiWs = null;
        this.setState({ wifiConnected: false });
        if (this.wifiEndpoint && this.shouldRun) {
          void this.sendHttpHeartbeat('wifi', false);
          this.wifiReconnectTimer = setTimeout(() => {
            this.wifiRetryDelay = Math.min(5000, Math.round(this.wifiRetryDelay * 1.4));
            this.openWifiSocket();
          }, this.wifiRetryDelay);
        }
      };

      ws.onerror = () => {
        void this.sendHttpHeartbeat('wifi', false);
      };
    } catch {
      this.setState({ wifiConnected: false });
    }
  }

  private async sendHttpHeartbeat(channel: ConnectionMode, httpOnly: boolean) {
    if (!this.lastProfile) return;
    const ep =
      channel === 'wifi'
        ? this.resolveWifiEndpoint(this.lastProfile.lanServerUrl)
        : this.resolveOnlineEndpoint();
    if (!ep) return;

    const token = channel === 'wifi' ? this.wifiSessionToken : this.onlineSessionToken;
    try {
      const res = await fetch(`${ep.httpUrl}/api/peers/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.lastProfile,
          httpOnly,
          sessionToken: token || undefined,
        }),
      });
      if (res.status === 409) {
        const data = (await res.json()) as { error?: string };
        this.setState({
          ...(channel === 'wifi' ? { wifiRegisteredCode: null } : { registeredCode: null }),
          codeConflictError: data.error || 'تعارض في الرقم الخاص على الشبكة',
        });
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { sessionToken?: string; events?: Array<Record<string, unknown>> };
      if (data.sessionToken) {
        if (channel === 'wifi') this.wifiSessionToken = data.sessionToken;
        else this.onlineSessionToken = data.sessionToken;
      }
      if (channel === 'wifi') {
        this.setState({
          wifiConnected: true,
          wifiRegisteredCode: this.lastProfile.privateCode,
          wifiError: null,
        });
      } else if (!this.state.registeredCode) {
        this.setState({ registeredCode: this.lastProfile.privateCode, codeConflictError: null });
      }
      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          this.handleChannelMessage(channel, ev);
        }
      }
    } catch {
      // Unreachable on this channel
    }
  }

  private sendToChannel(channel: ConnectionMode, payload: unknown): boolean {
    const ws = channel === 'wifi' ? this.wifiWs : this.onlineWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  public send(payload: unknown): boolean {
    return this.sendToChannel(this.state.activeTransport, payload);
  }

  private handleChannelMessage(channel: ConnectionMode, msg: Record<string, unknown>) {
    const type = String(msg.type || '');

    if (type === 'register:ok') {
      const code = String(msg.privateCode || '');
      const tok = String(msg.sessionToken || '');
      if (channel === 'wifi') {
        if (tok) this.wifiSessionToken = tok;
        this.setState({
          wifiConnected: true,
          wifiRegisteredCode: code,
          codeConflictError: null,
        });
        this.sendToChannel('wifi', { type: 'discover_wifi' });
      } else {
        if (tok) this.onlineSessionToken = tok;
        this.setState({
          registeredCode: code,
          codeConflictError: null,
        });
      }
      return;
    }

    if (type === 'register:error') {
      this.setState({
        ...(channel === 'wifi' ? { wifiRegisteredCode: null } : { registeredCode: null }),
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
        activeTransport: channel,
        outgoingInvite: (msg.invite as ChallengeInvite) || null,
        challengeNotice: null,
      });
      return;
    }

    if (type === 'challenge:incoming') {
      this.setState({
        activeTransport: channel,
        incomingInvite: (msg.invite as ChallengeInvite) || null,
      });
      return;
    }

    if (type === 'challenge:declined' || type === 'challenge:expired' || type === 'challenge:error') {
      this.setState({
        outgoingInvite: null,
        incomingInvite:
          this.state.incomingInvite?.inviteId === msg.inviteId ? null : this.state.incomingInvite,
        challengeNotice: String(msg.message || ''),
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
        activeTransport: room?.mode || channel,
        room,
        outgoingInvite: null,
        incomingInvite: null,
        challengeNotice: null,
        chatClosedMessage: null,
      });
      return;
    }

    if (type === 'room:player_left') {
      this.setState({ teamNotice: String(msg.message || 'غادر صديقك اللعبة') });
      return;
    }

    if (type === 'chat:history') {
      this.setState({ messages: (msg.messages as ChatMessage[]) || [] });
      return;
    }

    if (type === 'chat:message') {
      const m = msg.message as ChatMessage;
      if (!m || this.state.messages.some((x) => x.id === m.id)) return;
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
      this.setState({
        speakingPeers: { ...this.state.speakingPeers, [fromCode]: Boolean(msg.speaking) },
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

  // ==================== PUBLIC HOSTING & DISCOVERY ACTIONS ====================
  public async startWifiHost(): Promise<WifiHostStatus> {
    if (!this.lastProfile) {
      throw new Error('بيانات الملف الشخصي غير جاهزة بعد.');
    }
    this.setState({ wifiError: null });
    const status = await startWifiHostNative({
      privateCode: this.lastProfile.privateCode,
      name: this.lastProfile.name,
      avatarId: this.lastProfile.avatarId,
      levelId: this.lastProfile.levelId,
    });
    this.setState({ wifiHostStatus: status, activeTransport: 'wifi' });
    if (status.active && status.httpUrl) {
      this.connectWifiEndpoint({ httpUrl: status.httpUrl, wsUrl: status.wsUrl });
    }
    return status;
  }

  public async stopWifiHost(): Promise<void> {
    const status = await stopWifiHostNative();
    this.setState({ wifiHostStatus: status });
    this.disconnectWifiEndpoint();
  }

  public async discoverWifi() {
    this.setState({ wifiLoading: true, wifiError: null });

    if (isNativeAndroidWifiSupported()) {
      try {
        const hosts = await startWifiDiscoveryNative();
        const latest = hosts.length > 0 ? hosts : await getDiscoveredWifiHostsNative();
        this.handleNativeDiscoveredHosts(latest);
      } catch (err) {
        this.setState({
          wifiLoading: false,
          wifiError:
            err instanceof Error
              ? err.message
              : 'تعذر بدء الاكتشاف التلقائي على شبكة الواي فاي.',
        });
      }
    }

    const wifiEp = this.resolveWifiEndpoint(this.lastProfile?.lanServerUrl);
    if (!wifiEp) {
      if (!isNativeAndroidWifiSupported()) {
        this.setState({
          wifiLoading: false,
          wifiError:
            'في المتصفح/PWA لا يمكن تشغيل خادم Wi-Fi أوفلاين أو البث التلقائي mDNS. يمكنك إدخال عنوان خادم الهاتف المضيف (مثل 192.168.43.1:38421) للاتصال به على نفس الواي فاي.',
        });
      } else {
        this.setState({ wifiLoading: false });
      }
      return;
    }

    this.connectWifiEndpoint(wifiEp);
    this.sendToChannel('wifi', { type: 'discover_wifi' });

    try {
      await this.sendHttpHeartbeat('wifi', false);
      const self = encodeURIComponent(this.lastProfile?.privateCode || '');
      const res = await fetch(`${wifiEp.httpUrl}/api/peers/wifi?self=${self}`);
      if (res.ok) {
        const data = (await res.json()) as { peers?: PeerInfo[] };
        this.setState({
          wifiPeers: data.peers || [],
          wifiConnected: true,
          wifiLoading: false,
          wifiError: null,
        });
      } else {
        this.setState({ wifiLoading: false });
      }
    } catch {
      this.setState({
        wifiLoading: false,
        wifiError: 'تعذر الاتصال بخادم المضيف على الشبكة المحلية — تأكد من تشغيل نقطة الاتصال وزر الاستضافة على هاتف المضيف.',
      });
    }
  }

  public async stopWifiDiscovery() {
    await stopWifiDiscoveryNative();
  }

  public async challengeDiscoveredHost(host: DiscoveredWifiHost, useTimer: boolean) {
    this.setState({ challengeNotice: null, wifiError: null, activeTransport: 'wifi' });
    this.connectWifiEndpoint({ httpUrl: host.httpUrl, wsUrl: host.wsUrl });

    // Wait up to 2.5s for socket/registration to settle, otherwise fallback to HTTP POST cleanly
    for (let i = 0; i < 10; i++) {
      if (this.wifiWs && this.wifiWs.readyState === WebSocket.OPEN && this.state.wifiRegisteredCode) {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    await this.sendChallenge(host.privateCode, 'wifi', useTimer);
  }

  // ==================== SEARCH & LOOKUP ====================
  public async searchPeers(query: string, scope: 'wifi' | 'online' | 'all' = 'all') {
    this.setState({ searchingPeers: true, searchError: null });
    const channel: ConnectionMode = scope === 'wifi' ? 'wifi' : 'online';
    const ep =
      channel === 'wifi'
        ? this.resolveWifiEndpoint(this.lastProfile?.lanServerUrl)
        : this.resolveOnlineEndpoint();

    if (!ep) {
      this.setState({
        searchingPeers: false,
        searchError:
          scope === 'wifi'
            ? 'لا يوجد خادم مضيف واي فاي متصل حالياً. ابدأ البحث عن المضيفين أولاً.'
            : 'تعذر الوصول إلى خادم الإنترنت حالياً.',
      });
      return;
    }

    this.sendToChannel(channel, { type: 'search_peers', query, scope });
    try {
      await this.sendHttpHeartbeat(channel, false);
      const params = new URLSearchParams({
        q: query.trim(),
        scope,
        self: this.lastProfile?.privateCode || '',
      });
      const res = await fetch(`${ep.httpUrl}/api/peers/search?${params.toString()}`);
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

  public async lookupPeer(targetCode: string, mode: ConnectionMode = 'online'): Promise<PeerInfo | null> {
    const clean = targetCode.trim();
    this.setState({ lookupError: null, lookedUpPeer: null });
    const ep =
      mode === 'wifi'
        ? this.resolveWifiEndpoint(this.lastProfile?.lanServerUrl)
        : this.resolveOnlineEndpoint();
    if (!ep) return null;

    this.sendToChannel(mode, { type: 'lookup_peer', targetCode: clean });
    try {
      const self = encodeURIComponent(this.lastProfile?.privateCode || '');
      const res = await fetch(`${ep.httpUrl}/api/peers/lookup/${encodeURIComponent(clean)}?self=${self}`);
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
      // Ignore if unreachable
    }
    return null;
  }

  // ==================== CHALLENGES & TEAMS ====================
  public async sendChallenge(toCode: string, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ challengeNotice: null, activeTransport: mode });
    const sent = this.sendToChannel(mode, {
      type: 'challenge:send',
      toCode,
      mode,
      useTimer,
      timerSeconds: 15,
    });
    if (sent) return;

    const ep =
      mode === 'wifi'
        ? this.resolveWifiEndpoint(this.lastProfile?.lanServerUrl)
        : this.resolveOnlineEndpoint();

    if (!ep || !this.lastProfile) {
      this.setState({
        challengeNotice:
          mode === 'wifi'
            ? 'لا يوجد خادم مضيف متصل على الواي فاي — اضغط "استضافة مباراة Wi-Fi" على الهاتف الأول أو اتصل بالمضيف المكتشف.'
            : 'غير متصل بخادم الإنترنت حالياً — تأكد من الشبكة وأعد المحاولة.',
      });
      return;
    }

    try {
      await this.sendHttpHeartbeat(mode, false);
      const res = await fetch(`${ep.httpUrl}/api/challenges/send`, {
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
      this.setState({
        challengeNotice:
          mode === 'wifi'
            ? 'تعذر الوصول إلى المضيف المحلي على الواي فاي — تأكد من بقاء المضيف نشطاً.'
            : 'تعذر إرسال التحدي — تأكد من الاتصال بالإنترنت.',
      });
    }
  }

  public respondToChallenge(inviteId: string, accept: boolean) {
    const inviteMode = this.state.incomingInvite?.mode || this.state.activeTransport;
    this.setState({ incomingInvite: null, activeTransport: inviteMode });
    const sent = this.sendToChannel(inviteMode, { type: 'challenge:respond', inviteId, accept });
    if (!sent) {
      this.setState({ challengeNotice: 'انتظر إعادة الاتصال بالخادم لإتمام التحدي.' });
    }
  }

  public createTeam(teamName: string, format: TeamFormat, mode: ConnectionMode, useTimer: boolean) {
    this.setState({ teamNotice: null, messages: [], activeTransport: mode });
    const sent = this.sendToChannel(mode, { type: 'team:create', teamName, format, mode, useTimer });
    if (!sent) {
      this.setState({
        teamNotice:
          mode === 'wifi'
            ? 'للعب فريق على الواي فاي أوفلاين، شغّل الاستضافة أو اتصل بالمضيف المحلي أولاً.'
            : 'جاري الاتصال بخادم الإنترنت، حاول بعد لحظة.',
      });
    }
  }

  public requestJoinTeam(codeOrLeader: string, side: 'A' | 'B' = 'A', mode?: ConnectionMode) {
    const targetMode = mode || (this.wifiEndpoint ? 'wifi' : 'online');
    this.setState({ teamNotice: null, activeTransport: targetMode });
    const sent = this.sendToChannel(targetMode, { type: 'team:join_request', codeOrLeader, side });
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

  public submitGameAnswer(
    isCorrect: boolean,
    answeredCount: number,
    submittedAnswer?: string,
    questionIndex?: number,
  ) {
    this.send({
      type: 'game:answer',
      isCorrect,
      answeredCount,
      submittedAnswer,
      questionIndex,
    });
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
