import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work under https://<user>.github.io/steam_radar/
// The site imports ../shared (scoring + metrics), so Vite needs access to the parent folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
