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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // BabaBang 디자인 토큰 (홈/마이=다크, 커뮤니티/추천/북마크=라이트)
        baba: {
          dark: "#0a0a0f",
          "dark-card": "rgba(255,255,255,0.06)",
          light: "#f5f6fa",
          "light-card": "rgba(255,255,255,0.8)",
        },
        accent: "#6c5ce7",
        gold: "#ffd32a",
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "sans-serif"],
        sans: ["var(--font-noto-sans-kr)", "sans-serif"],
      },
      backdropBlur: {
        card: "20px",
      },
      maxWidth: {
        mobile: "430px",
      },
      animation: {
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.25s ease-out",
      },
      keyframes: {
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.08)",
        "glass-dark": "0 8px 32px rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
