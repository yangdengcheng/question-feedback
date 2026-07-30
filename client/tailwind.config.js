/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 方案 C · 信号橙
        primary: "#fbbf24",
        "primary-strong": "#f59e0b",
        accent: "#fbbf24",
        // 基底
        ink: "#0b1120",
        surface: {
          DEFAULT: "#121a2b",
          2: "#1a2438",
        },
        line: {
          DEFAULT: "rgba(148,163,184,0.14)",
          strong: "rgba(148,163,184,0.24)",
        },
        // 文本
        "ink-text": "#e6edf6",
        "ink-text-2": "#9aa7bc",
        "ink-text-3": "#5c6b82",
        // 状态色
        "st-pending": "#f59e0b",
        "st-processing": "#38bdf8",
        "st-resolved": "#34d399",
        "st-closed": "#64748b",
      },
      fontFamily: {
        disp: ['"Space Grotesk"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
      borderRadius: {
        panel: "10px",
        ctl: "6px",
      },
    },
  },
  plugins: [],
};
