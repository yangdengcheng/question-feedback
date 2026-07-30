/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        accent: "#06b6d4",
        surface: "#0f172a",
      },
    },
  },
  plugins: [],
};
