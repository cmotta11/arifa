import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "0px",
      sm: "600px",
      md: "905px",
      lg: "1240px",
      xl: "1440px",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6200EE",
          light: "#9c4dff",
          dark: "#3700B3",
        },
        secondary: {
          DEFAULT: "#ff9800",
          light: "#ffc947",
          dark: "#c66900",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          light: "#fafbfc",
          border: "#E0E0E0",
        },
        background: "#fafbfc",
        success: "#4CAF50",
        warning: "#FFC107",
        error: "#B00020",
        info: "#2196F3",
      },
      spacing: {
        "0.5": "4px",
        "1": "8px",
        "1.5": "12px",
        "2": "16px",
        "3": "24px",
        "4": "32px",
        "5": "40px",
        "6": "48px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      fontFamily: {
        sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "elevation-1":
          "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        "elevation-2":
          "0 3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12)",
        "elevation-3":
          "0 10px 20px rgba(0,0,0,0.15), 0 3px 6px rgba(0,0,0,0.10)",
        "elevation-4":
          "0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
