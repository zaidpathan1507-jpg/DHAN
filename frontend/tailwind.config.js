/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Manrope for Latin + figures; Mukta/Noto carry Devanagari so Hindi never falls to a system font.
        sans: ['"Manrope"', '"Mukta"', '"Noto Sans Devanagari"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0B1B2B",
          deep: "#06121E",
          soft: "#33475B",
          muted: "#566676",
        },
        gold: {
          50: "#FFF7DD",
          100: "#FDEBB0",
          400: "#F6C244",
          500: "#F0B429",
          600: "#D9990B",
          700: "#8F6200",
        },
        gain: { DEFAULT: "#0F7B58", soft: "#E2F3EB", ink: "#0A5A40" },
        loss: { DEFAULT: "#B42318", soft: "#FCE9E7" },
        warn: { DEFAULT: "#A15C07", soft: "#FEF1DC" },
        info: { DEFAULT: "#1D5FA8", soft: "#E5EEF9" },
        surface: {
          DEFAULT: "#F5F4EF",
          muted: "#ECEAE2",
          card: "#FFFFFF",
          border: "#E2DFD5",
          strong: "#CFCBBE",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(11, 27, 43, 0.05), 0 1px 1px rgba(11, 27, 43, 0.03)",
        card: "0 2px 10px rgba(11, 27, 43, 0.06)",
        elevated: "0 10px 30px rgba(11, 27, 43, 0.14), 0 2px 6px rgba(11, 27, 43, 0.06)",
        hero: "0 18px 40px -12px rgba(6, 18, 30, 0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "sheet-up": "sheet-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
