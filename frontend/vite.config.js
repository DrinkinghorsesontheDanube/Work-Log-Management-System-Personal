import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router'],
      dts: false
    })
  ],
  server: {
    port: 10010,
    proxy: {
      '/api': {
        target: 'http://localhost:10086',
        changeOrigin: true
      }
    }
  }
})
