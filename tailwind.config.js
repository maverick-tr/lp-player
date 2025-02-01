/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inconsolata', 'monospace'],
        mono: ['Inconsolata', 'monospace'],
      },
      colors: {
        'tool-dark': '#000000',
        'tool-darker': '#0a0a0a',
        'tool-light': '#1a1a1a',
        'tool-accent': '#ffffff',
        'tool-border': '#bccc0f',
        'tool-accent-light': 'rgba(255, 255, 255, 0.1)',
        'tool-card-gradient': 'linear-gradient(135deg, rgba(188,204,15,0.1) 0%, rgba(0,0,0,0) 100%)',
        'tool-light-mode': {
          'bg': '#f5f7fa',
          'card': '#ffffff',
          'text': '#1a1a1a',
          'accent': '#000000',
          'border': '#e5e7eb',
          'hover': '#f8fafc',
          'button': '#18181b',
          'button-hover': '#27272a'
        }
      },
      boxShadow: {
        'light-card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'light-card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'dark-glow': '0 0 20px rgba(188,204,15,0.1)',
      }
    },
  },
  plugins: [],
} 