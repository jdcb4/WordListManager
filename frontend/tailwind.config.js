/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(200 12% 82%)",
        input: "hsl(200 12% 82%)",
        ring: "hsl(188 70% 33%)",
        background: "hsl(44 30% 95%)",
        foreground: "hsl(202 23% 16%)",
        primary: {
          DEFAULT: "hsl(188 70% 33%)",
          foreground: "hsl(0 0% 100%)",
        },
        muted: {
          DEFAULT: "hsl(203 18% 94%)",
          foreground: "hsl(207 12% 42%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(202 23% 16%)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};
