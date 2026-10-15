/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b1c",
        panel: "#0d1330",
        edge: "#1e2a5c",
        pulse: "#38e1ff",
        ship: "#2fd07a",
        partial: "#f2b632",
        vapor: "#f2565b",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(56,225,255,0.18)",
      },
    },
  },
  plugins: [],
};
