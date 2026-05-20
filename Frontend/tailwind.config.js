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
        },
        sparkle: {
          "0%, 100%": { opacity: "0.25", transform: "translateY(0) scale(0.9) rotate(0deg)" },
          "50%": { opacity: "1", transform: "translateY(-10px) scale(1.08) rotate(8deg)" }
        },
        breathe: {
          "0%, 100%": { opacity: "0.55", transform: "scale(0.96)" },
          "50%": { opacity: "1", transform: "scale(1.04)" }
        }
      },
      animation: {
        "pulse-line": "pulse-line 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        sparkle: "sparkle 2.2s ease-in-out infinite",
        breathe: "breathe 2.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
