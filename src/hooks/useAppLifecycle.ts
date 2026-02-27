import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Handles Capacitor app lifecycle events on native platforms.
 * - Reconnects WebSocket on resume
 * No-op on web/PWA.
 */
export const useAppLifecycle = (onResume?: () => void) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const resumeHandler = App.addListener('resume', () => {
      console.log('[Lifecycle] App resumed');
      onResume?.();
    });

    return () => {
      resumeHandler.then(h => h.remove());
    };
  }, [onResume]);
};
