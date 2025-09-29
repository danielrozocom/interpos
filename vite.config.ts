import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit()
  ],
  base: process.env.NODE_ENV === 'production' ? '/interpos/' : '/',
  optimizeDeps: {
    include: ['@zxing/browser', '@zxing/library']
  },
  ssr: {
    noExternal: ['@zxing/browser', '@zxing/library']
  },
  build: {
    rollupOptions: {
      external: [
        'supports-color',
        'google-spreadsheet',
        'googleapis'
      ]
    }
  }
});