import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl' // <-- Вернули плагин

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl() // <-- Снова генерируем HTTPS-сертификат для iOS
  ],
  server: {
    https: true, 
    host: true,
    // Настраиваем ПРОКСИ: фронтенд сам будет передавать запросы бэкенду
    proxy: {
      '/api': {
        target: 'http://192.168.1.194:5000', // Адрес твоего запущенного бэкенда
        changeOrigin: true,
        secure: false
      }
    }
  }
})