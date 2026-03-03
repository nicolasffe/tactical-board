/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Mudamos de 'tailwindcss' para '@tailwindcss/postcss'
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};

export default config;