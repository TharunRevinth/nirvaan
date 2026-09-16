/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAF9",
        surface: "#FFFFFF",
        primary: "#1A1A18",
        secondary: "#575753",
        muted: "#71716D",
        subtle: "#A1A19D",
        line: "#E8E6E1",
        "line-strong": "#D1CECA",
        oxide: {
          DEFAULT: "#A13D2B",
          hover: "#8A3323",
          light: "#FBF3F1",
          border: "#EACDC7",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

