// vite.config.js
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    laravel({
      // エントリは app.js/app.css に統一
      input: ['resources/css/app.css', 'resources/js/app.js'],
      refresh: true,
    }),
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',     // ← 127.0.0.1 ではなく localhost に固定
    port: 5173,            // ← ケースCの解説と同じポート
    strictPort: true,      // ← 5173 が使えない時に勝手に 5174 へ逃げない
    hmr: { host: 'localhost', port: 5173, protocol: 'ws' }, // ← これを追加
    // ★ 跨り通信を検証するために proxy は使わない（コメントアウト例）
    // proxy: {
    //   '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    //   '/sanctum/csrf-cookie': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    //   '/login': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    //   '/logout': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    // },
  },
})