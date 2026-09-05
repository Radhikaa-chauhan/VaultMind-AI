import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3100',
      '/status': 'http://127.0.0.1:3100',
      '/transactions': 'http://127.0.0.1:3100',
      '/policies': 'http://127.0.0.1:3100',
      '/alerts': 'http://127.0.0.1:3100',
      '/disputes': 'http://127.0.0.1:3100',
      '/agents': 'http://127.0.0.1:3100',
      '/stats': 'http://127.0.0.1:3100',
      '/metrics': 'http://127.0.0.1:3100',
      '/events': 'http://127.0.0.1:3100',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
