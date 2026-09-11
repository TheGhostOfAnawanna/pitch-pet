import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project at https://<user>.github.io/pitch-pet/,
  // so asset URLs must be prefixed with the repo name. Without this the
  // deployed page loads index.html and then 404s on /assets/*.js — a blank
  // white screen with no error on the page itself.
  base: '/pitch-pet/',
  plugins: [react()],
})
