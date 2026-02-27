import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Returns the current on-screen keyboard height in pixels.
 * Always returns 0 on web/PWA — only meaningful on native Android/iOS.
 */
export const useKeyboard = (): number => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });
    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then(h => h.remove());
      hideListener.then(h => h.remove());
    };
  }, []);

  return keyboardHeight;
};
