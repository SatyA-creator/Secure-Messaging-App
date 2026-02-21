import { Capacitor } from '@capacitor/core';

export const platform = {
  isNative: () => Capacitor.isNativePlatform(),
  isAndroid: () => Capacitor.getPlatform() === 'android',
  isIOS: () => Capacitor.getPlatform() === 'ios',
  isWeb: () => Capacitor.getPlatform() === 'web',
  isPWA: () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches,
} as const;
