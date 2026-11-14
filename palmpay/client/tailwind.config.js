/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // PalmPay brand palette
        brand: {
          50: "#eefaf4",
          100: "#d6f3e6",
          200: "#aee7cf",
          300: "#7dd6b1",
          400: "#47bd8e",
          500: "#22a16f",
          600: "#157f58",
          700: "#116346",
          800: "#0f4e39",
          900: "#0c3e2e",
        },
      },
      keyframes: {
        scan: {
          "0%":   { transform: "translateY(-100%)" },
          "50%":  { transform: "translateY(100%)" },
          "100%": { transform: "translateY(-100%)" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(34,161,111,0.6)" },
          "50%":     { boxShadow: "0 0 0 18px rgba(34,161,111,0)" },
        },
      },
      animation: {
        scan: "scan 2s ease-in-out infinite",
        glow: "pulseGlow 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
