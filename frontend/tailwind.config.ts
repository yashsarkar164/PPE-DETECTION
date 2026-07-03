import type { Config } from "tailwindcss";

/**
 * Design system: "Site Compliance" industrial theme.
 * Palette is drawn directly from hazard signage: safety-yellow for primary
 * actions and compliant states, safety-orange reserved specifically for
 * violation/warning states (so color itself carries meaning — yellow = go/
 * compliant, orange = stop/violation), charcoal/graphite for structure,
 * near-black for chrome. No decorative color outside this set.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core hazard palette
        safety: {
          yellow: "#F5C300",
          "yellow-dim": "#B89400",
          orange: "#E8590C",
          "orange-dim": "#C24A0A",
        },
        graphite: {
          950: "#0B0C0E",
          900: "#131519",
          800: "#1C1F26",
          700: "#282C34",
          600: "#3A3F4B",
          500: "#565D6D",
          400: "#7A8194",
          300: "#A6ABB8",
          200: "#D3D6DC",
          100: "#EDEEF1",
          50: "#F7F8F9",
        },
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
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "pulse-warn": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-warn": "pulse-warn 1.4s ease-in-out infinite",
        "scan-line": "scan-line 2.5s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
