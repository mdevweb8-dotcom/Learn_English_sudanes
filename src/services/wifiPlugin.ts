import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { DiscoveredWifiHost, WifiHostStatus } from '../types';

export interface LocalWifiMultiplayerNativePlugin {
  startHost(options: {
    privateCode: string;
    name: string;
    avatarId: string;
    levelId: string;
  }): Promise<WifiHostStatus>;
  stopHost(): Promise<WifiHostStatus>;
  getHostStatus(): Promise<WifiHostStatus>;
  startDiscovery(): Promise<{ started: boolean; hosts: DiscoveredWifiHost[] }>;
  stopDiscovery(): Promise<{ stopped: boolean }>;
  getDiscoveredHosts(): Promise<{ hosts: DiscoveredWifiHost[] }>;
  getLocalNetworkInfo(): Promise<{ ip: string; supported: boolean }>;
  addListener(
    eventName: 'wifiHostsChanged',
    listenerFunc: (data: { hosts: DiscoveredWifiHost[] }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'hostStatusChanged',
    listenerFunc: (status: WifiHostStatus) => void,
  ): Promise<PluginListenerHandle>;
}

const LocalWifiMultiplayer = registerPlugin<LocalWifiMultiplayerNativePlugin>('LocalWifiMultiplayer');

export function isNativeAndroidWifiSupported(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('LocalWifiMultiplayer')
    );
  } catch {
    return false;
  }
}

export async function startWifiHostNative(options: {
  privateCode: string;
  name: string;
  avatarId: string;
  levelId: string;
}): Promise<WifiHostStatus> {
  if (!isNativeAndroidWifiSupported()) {
    throw new Error('وضع استضافة الواي فاي المباشر أوفلاين متاح في تطبيق الأندرويد فقط.');
  }
  return await LocalWifiMultiplayer.startHost(options);
}

export async function stopWifiHostNative(): Promise<WifiHostStatus> {
  if (!isNativeAndroidWifiSupported()) {
    return {
      active: false,
      ip: '',
      httpPort: 0,
      wsPort: 0,
      httpUrl: '',
      wsUrl: '',
      connectedCount: 0,
      serviceName: '',
    };
  }
  return await LocalWifiMultiplayer.stopHost();
}

export async function getWifiHostStatusNative(): Promise<WifiHostStatus> {
  if (!isNativeAndroidWifiSupported()) {
    return {
      active: false,
      ip: '',
      httpPort: 0,
      wsPort: 0,
      httpUrl: '',
      wsUrl: '',
      connectedCount: 0,
      serviceName: '',
    };
  }
  return await LocalWifiMultiplayer.getHostStatus();
}

export async function startWifiDiscoveryNative(): Promise<DiscoveredWifiHost[]> {
  if (!isNativeAndroidWifiSupported()) return [];
  const res = await LocalWifiMultiplayer.startDiscovery();
  return Array.isArray(res?.hosts) ? res.hosts : [];
}

export async function stopWifiDiscoveryNative(): Promise<void> {
  if (!isNativeAndroidWifiSupported()) return;
  try {
    await LocalWifiMultiplayer.stopDiscovery();
  } catch {
    // Ignore cleanup error
  }
}

export async function getDiscoveredWifiHostsNative(): Promise<DiscoveredWifiHost[]> {
  if (!isNativeAndroidWifiSupported()) return [];
  const res = await LocalWifiMultiplayer.getDiscoveredHosts();
  return Array.isArray(res?.hosts) ? res.hosts : [];
}

export async function getLocalWifiIpNative(): Promise<string> {
  if (!isNativeAndroidWifiSupported()) return '';
  try {
    const res = await LocalWifiMultiplayer.getLocalNetworkInfo();
    return res?.ip || '';
  } catch {
    return '';
  }
}

export async function addWifiHostsListener(
  cb: (hosts: DiscoveredWifiHost[]) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNativeAndroidWifiSupported()) return null;
  return await LocalWifiMultiplayer.addListener('wifiHostsChanged', (data) => {
    cb(Array.isArray(data?.hosts) ? data.hosts : []);
  });
}

export async function addWifiHostStatusListener(
  cb: (status: WifiHostStatus) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNativeAndroidWifiSupported()) return null;
  return await LocalWifiMultiplayer.addListener('hostStatusChanged', cb);
}
