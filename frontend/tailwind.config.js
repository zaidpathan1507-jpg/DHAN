/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        dhan: {
          green: "#1F8A56",
          "green-dark": "#166945",
          "green-light": "#E6F3EB",
        },
        navy: {
          DEFAULT: "#0E1F2E",
          soft: "#2A3C4D",
        },
        slate: {
          925: "#111A22",
        },
        surface: {
          DEFAULT: "#FBFAF8",
          muted: "#F4F2EE",
          card: "#FFFFFF",
          border: "#E7E3DC",
        },
        amber: {
          DEFAULT: "#B8860B",
          light: "#FDF3DC",
        },
        danger: {
          DEFAULT: "#C0392B",
          light: "#FBE9E7",
        },
        info: {
          DEFAULT: "#2563A8",
          light: "#E7F0FA",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(14, 31, 46, 0.04), 0 1px 1px rgba(14, 31, 46, 0.03)",
        card: "0 2px 8px rgba(14, 31, 46, 0.06)",
        elevated: "0 8px 24px rgba(14, 31, 46, 0.10)",
      },
      spacing: {
        18: "4.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 320ms ease-out",
      },
    },
  },
  plugins: [],
};
