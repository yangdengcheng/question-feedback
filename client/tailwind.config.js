/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 方案 C · 信号橙（接 CSS 变量，随主题切换）
        primary: "var(--accent)",
        "primary-strong": "var(--accent-strong)",
        accent: "var(--accent)",
        "accent-text": "var(--accent-text)",
        "accent-soft": "var(--accent-soft)",
        "accent-border": "var(--accent-border)",
        // 基底
        ink: "var(--ink)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        // 文本
        "ink-text": "var(--text)",
        "ink-text-2": "var(--text-2)",
        "ink-text-3": "var(--text-3)",
        // 状态色
        "st-pending": "var(--st-pending)",
        "st-processing": "var(--st-processing)",
        "st-resolved": "var(--st-resolved)",
        "st-closed": "var(--st-closed)",
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
