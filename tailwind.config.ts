import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        safety: "#F2C200",
        asphalt: "#1E1E1E",
        tar: "#2A2A28",
        concrete: { 50: "#F4F3EF", 100: "#E9E7E1", 200: "#D6D3CB", 300: "#B9B5AB", 500: "#7C786F", 700: "#4A4741" },
        tag: "#EFE9DA",
        hazard: "#D9480F",
        claimed: "#2F9E44",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "Arial Narrow", "sans-serif"],
        body: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
