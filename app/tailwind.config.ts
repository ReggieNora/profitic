import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0e7ff",
          100: "#d4bbff",
          200: "#b78fff",
          300: "#9a63ff",
          400: "#7d37ff",
          500: "#6b1fff",
          600: "#5a1adb",
          700: "#4914b7",
          800: "#380f93",
          900: "#270a6f",
        },
        accent: {
          50: "#e0f2ff",
          100: "#b3daff",
          200: "#80c1ff",
          300: "#4da8ff",
          400: "#1a8fff",
          500: "#0077e6",
          600: "#005db3",
          700: "#004480",
          800: "#002a4d",
          900: "#00111a",
        },
        surface: {
          50: "#2a2d3a",
          100: "#232636",
          200: "#1c1f32",
          300: "#16182b",
          400: "#101225",
          500: "#0b0d1e",
          600: "#080a18",
          700: "#050712",
          800: "#03040c",
          900: "#010206",
        },
      },
      backgroundImage: {
        "gradient-primary":
          "linear-gradient(135deg, #6b1fff 0%, #0077e6 100%)",
        "gradient-card":
          "linear-gradient(180deg, rgba(107,31,255,0.08) 0%, rgba(0,119,230,0.08) 100%)",
        "gradient-glow":
          "radial-gradient(ellipse at center, rgba(107,31,255,0.15) 0%, transparent 70%)",
        "gradient-hot":
          "linear-gradient(135deg, #ff6b35 0%, #f7c948 100%)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
    },
  },
  plugins: [],
};

export default config;
