import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teamnifty.nuxbe',
  appName: 'Nuxbe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*'
    ],
  },
    appendUserAgent: 'Nuxbe-Mobile/1.0.0 (Capacitor)',
  ios: {
    contentInset: 'automatic'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#6366f1',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Camera: {
      saveToGallery: false
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false
    }
  }
};

export default config;
