import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend de desarrollo redirige las llamadas /api al servidor Express
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
