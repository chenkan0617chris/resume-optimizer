import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/resume-optimizer/',
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-libs': ['pdfjs-dist', '@react-pdf/renderer'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts']
        }
      }
    }
  }
});
