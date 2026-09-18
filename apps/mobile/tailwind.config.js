/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        discordia: {
          bg: '#23272a',
          card: '#2c2f33',
          blurple: '#7289da',
          blurpleHover: '#677bc4',
          muted: '#99aab5',
          dark: '#1e2124',
        },
      },
    },
  },
  plugins: [],
};
