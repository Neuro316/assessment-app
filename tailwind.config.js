/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neuro-blue': '#386797',
        'aurora-indigo': '#324C66',
        'cortex-charcoal': '#393939',
        'synapse-mist': '#E9EDF0',
        'capacity-green': '#4A9B7F',
        'conserve-amber': '#D4A843',
        'high-conserve-red': '#C0625A',
        'pale-blue': '#F0F4F8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
