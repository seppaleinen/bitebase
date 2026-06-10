/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/native/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#c75146",
          dark: "#a84036",
          light: "#f0d9d6",
          subtle: "#f8edea",
        },
        secondary: {
          DEFAULT: "#6b8f7f",
          light: "#e3ede8",
          subtle: "#f0f5f2",
        },
        warm: {
          50: "#faf7f4",
          100: "#f5f0eb",
          200: "#ede7e0",
        },
      },
    },
  },
  plugins: [],
};
