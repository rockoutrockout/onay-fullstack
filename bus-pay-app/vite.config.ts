import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  // Блок server удален, так как Vercel игнорирует локальные хосты, 
  // а TypeScript больше не будет ругаться на host: true
})