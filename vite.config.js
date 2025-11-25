import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/mappa-italia/', // <--- AGGIUNGI QUESTA RIGA (usa il nome esatto del repo)
})