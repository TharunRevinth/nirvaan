/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: "#1C1F26",
        offwhite: "#F2EFE9",
        copper: "#B5541A",
        "copper-hover": "#8C3E10",
        slate: "#3D5A73",
        amber: "#C99A3E",
        hairline: "rgba(28, 31, 38, 0.15)",
        "hairline-light": "rgba(255, 255, 255, 0.15)"
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        full: "0px",
      },
      fontFamily: {
        sans: ["Noto Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
