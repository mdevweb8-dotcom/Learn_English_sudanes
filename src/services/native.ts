import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initNativeCapacitor() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1A6FA0' });
  } catch {
    // Ignore on unsupported web/platforms
  }
  try {
    await SplashScreen.hide();
  } catch {
    // Ignore
  }
}

export async function triggerHaptic(type: 'light' | 'success' | 'warning') {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  } catch {
    // Ignore
  }
}

export async function sendNativeNotification(title: string, body: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 100000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 200) },
        },
      ],
    });
  } catch {
    // Ignore
  }
}
