import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.edu.vku.fieldsurvey',
  appName: 'VKU Field Survey',
  webDir: 'dist',
  server: {
    // During development, set `url` to your Vite dev server (e.g.
    // 'http://192.168.1.10:5173') and `cleartext: true` to live-reload on a
    // physical device. Remove both for production builds so the app loads
    // the bundled `dist/` assets and works fully offline.
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      // No extra config needed; permissions are declared in
      // android/app/src/main/AndroidManifest.xml after `cap add android`.
    },
  },
};

export default config;
