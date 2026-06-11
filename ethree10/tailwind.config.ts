import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // E310 brand palette — teal primary, lime accent, navy ink
        brand: {
          50: "#e6faf8",
          100: "#c0f2ed",
          200: "#8ae7df",
          300: "#4dd6cc",
          400: "#1ec1b6",
          500: "#05b1a4",
          600: "#049488",
          700: "#06756d",
          800: "#0a5d57",
          900: "#0d4d49",
          950: "#022e2b",
        },
        // Navy ink — dark surfaces, headings, signature cards
        ink: {
          50: "#f3f5f7",
          100: "#e7e7e7",
          200: "#c8d2db",
          300: "#9aabba",
          400: "#5e768c",
          500: "#33495b",
          600: "#1b3247",
          700: "#0f2438",
          800: "#081d30",
          900: "#051a2c",
          950: "#031629",
        },
        // Lime — sparing signature accent (badges, one highlight per view)
        lime: {
          50: "#fbfde9",
          100: "#f4facb",
          200: "#ebf69e",
          300: "#ddef6f",
          400: "#ccec63",
          500: "#b4d93f",
          600: "#8fb52b",
          700: "#6c8a24",
          800: "#566d23",
          900: "#495c21",
        },
        // shadcn/ui semantic tokens (CSS variable backed)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "var(--font-inter)", ...fontFamily.sans],
        display: ["var(--font-jakarta)", ...fontFamily.sans],
        mono: ["var(--font-jetbrains-mono)", ...fontFamily.mono],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 6px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(3 22 41 / 0.04), 0 2px 8px rgb(3 22 41 / 0.06)",
        pop: "0 8px 24px rgb(3 22 41 / 0.10), 0 2px 6px rgb(3 22 41 / 0.06)",
        glow: "0 0 0 1px rgb(5 177 164 / 0.20), 0 8px 30px rgb(5 177 164 / 0.18)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.2,0.8,0.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
