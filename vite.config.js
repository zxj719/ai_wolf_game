import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    // 使用 esbuild 压缩 (Vite 内置，无需额外安装)
    minify: 'esbuild',
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
  // 生产环境移除 console.log
  esbuild: {
    drop: ['console', 'debugger'],
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/stock': {
        target: 'https://data.infoway.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stock\/kline/, '/stock/v2/batch_kline'),
        headers: {
          'apiKey': 'c2c3f1594d41409e9e1a198b3e494d47-infoway',
        },
      },
    },
  }
})
