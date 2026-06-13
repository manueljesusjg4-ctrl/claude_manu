/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa: azul marino + naranja de acento
        marino: {
          DEFAULT: '#162D45',
          claro: '#1F3D5C',
          oscuro: '#0E1F30',
        },
        acento: {
          DEFAULT: '#E6530C',
          claro: '#FF6B1A',
          suave: '#FDEDE4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
