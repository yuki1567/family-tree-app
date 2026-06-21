import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		react(),
	],
	resolve: {
		alias: {
			'@backend': path.resolve(__dirname, '../backend/src'),
		},
	},
	server: {
		host: true,
		port: 3000,
	},
})
