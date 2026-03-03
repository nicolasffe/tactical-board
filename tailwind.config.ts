import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        motus: {
          dark: "#071325",
          teal: "#19d3c5",
          blue: "#2f6bff",
          surface: "#0f1e33",
        },
      },
    },
  },
  plugins: [],
};
export default config;
