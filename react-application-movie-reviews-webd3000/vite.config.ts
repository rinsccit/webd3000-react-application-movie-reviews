import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Vite controls local development and production builds for the frontend
export default defineConfig({
  // Enables React and Tailwind processing for all source files
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Sends local /api calls to the backend service running on localhost:7195
      "/api": {
        target:"https://localhost:7195",
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
