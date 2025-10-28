import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // FIX: Remove unused Gemini API_KEY. Only PICOVOICE_ACCESS_KEY is needed for the local stack.
        'process.env.PICOVOICE_ACCESS_KEY': JSON.stringify(env.PICOVOICE_ACCESS_KEY)
      },
      resolve: {
        alias: {
          // FIX: `__dirname` is not available in ESM modules. `process.cwd()` provides the project root directory.
          '@': path.resolve(process.cwd()),
        }
      }
    };
});