import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "arifa-navy": {
          DEFAULT: "#04367d",
          light: "#0a4a9e",
          dark: "#022554",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          light: "#F5F5F5",
          border: "#E0E0E0",
        },
        success: "#2E7D32",
        warning: "#F57C00",
        error: "#C62828",
        info: "#1565C0",
      },
      fontFamily: {
        sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
