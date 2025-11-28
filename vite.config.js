import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['italy.png'],
            manifest: {
                name: 'Tracce - Mappa Italia',
                short_name: 'Tracce',
                description: 'Traccia i comuni visitati in Italia',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'italy.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'italy.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    // QUESTA RIGA È FONDAMENTALE PER GITHUB PAGES, NON TOGLIERLA!
    base: '/mappa-italia/',
})