/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06080f",
        panel: "#0d111c",
        electric: "#2563eb"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(37, 99, 235, 0.18), 0 24px 80px rgba(15, 23, 42, 0.12)"
      },
      keyframes: {
        "pulse-line": {
          "0%, 100%": { opacity: "0.35", transform: "scaleX(0.82)" },
          "50%": { opacity: "1", transform: "scaleX(1)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        }
      },
      animation: {
        "pulse-line": "pulse-line 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite"
      }
    }
  },
  plugins: []
};
