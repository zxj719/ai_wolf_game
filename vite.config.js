import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 生产环境移除 console.log (保留 warn 和 error)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        pure_funcs: ['console.log'] // 只移除 console.log，保留 warn/error
      }
    },
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true
  }
})
