import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quchat.app',
  appName: 'QuChat',
  webDir: 'dist',

  server: {
    // Uncomment for live-reload on device during development:
    // url: 'http://YOUR_LAN_IP:8080',
    // cleartext: true,
    androidScheme: 'https',
  },

  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
