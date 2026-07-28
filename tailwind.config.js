import preset from '@whiskeyjack-net/design-system/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@whiskeyjack-net/design-system/dist/index.js',
  ],
}
