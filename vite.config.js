import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        options: resolve(process.cwd(), 'options/index.html'),
        admin: resolve(process.cwd(), 'admin/index.html'),
        notFound: resolve(process.cwd(), '404.html'),
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', css: false },
});
