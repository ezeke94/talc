import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze'
  return {
    plugins: [
      react(),
      isAnalyze &&
        visualizer({
          filename: 'dist/bundle-report.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
          open: true,
        }),
    ].filter(Boolean),
    build: {
      sourcemap: isAnalyze,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            // Firebase split: auth vs firestore vs messaging vs app/core
            if (id.includes('/node_modules/firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth'
            if (id.includes('/node_modules/firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore'
            if (id.includes('/node_modules/firebase/messaging') || id.includes('firebase/messaging')) return 'firebase-messaging'
            if (id.includes('/node_modules/firebase/app') || id.includes('firebase/app')) return 'firebase-app'
            if (id.includes('/node_modules/firebase/')) return 'firebase'

            // MUI split: core vs icons vs date pickers vs emotion
            if (id.includes('/node_modules/@mui/icons-material') || id.includes('@mui/icons-material')) return 'mui-icons'
            if (id.includes('/node_modules/@mui/x-date-pickers') || id.includes('@mui/x-date-pickers')) return 'mui-pickers'
            if (id.includes('/node_modules/@mui/material') || id.includes('@mui/material')) return 'mui-core'
            if (id.includes('/node_modules/@emotion/react') || id.includes('/node_modules/@emotion/styled') || id.includes('@emotion/react') || id.includes('@emotion/styled')) return 'mui-emotion'
            if (id.includes('/node_modules/@mui/')) return 'mui'

            // Charts split
            if (id.includes('/node_modules/recharts') || id.includes('recharts')) return 'charts-recharts'
            if (id.includes('/node_modules/d3-') || id.includes('d3-')) return 'charts-d3'

            if (id.includes('@dnd-kit')) return 'dndkit'
            if (id.includes('date-fns')) return 'datefns'
            if (id.includes('/node_modules/react-router') || id.includes('react-router')) return 'router'
            return 'vendor'
          },
        },
      },
    },
  }
})
