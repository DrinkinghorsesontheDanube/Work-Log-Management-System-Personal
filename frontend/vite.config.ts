import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    // 开发模式把 API 请求代理到本地后端（server/server.js，默认 4173）
    proxy: {
      '/api': 'http://localhost:4173'
    }
  }
})
