import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

// 2026-06-07: DURABLE premium foundation. Lives in the tailwind config (which the
// agent almost never rewrites) — NOT only in index.css (which the agent rewrites
// wholesale when it re-skins a design direction, stripping the foundation). This
// guarantees premium fonts + depth + motion utilities survive ANY index.css
// edit. Fonts can still be overridden per-project by redefining the vars in
// index.css (cascade wins), but the floor keeps worst-case output polished.
const premiumFoundation = plugin(({ addBase, addComponents }) => {
  addBase({
    ":root": {
      "--font-sans": "'Inter', 'IBM Plex Sans Arabic', ui-sans-serif, system-ui, -apple-system, sans-serif",
      "--font-display": "'Sora', 'IBM Plex Sans Arabic', 'Inter', ui-sans-serif, system-ui, sans-serif",
      "--shadow-sm": "0 1px 2px 0 hsl(240 30% 12% / 0.04), 0 1px 3px 0 hsl(240 30% 12% / 0.06)",
      "--shadow-md": "0 2px 4px -1px hsl(240 30% 12% / 0.06), 0 8px 16px -4px hsl(240 30% 12% / 0.08)",
      "--shadow-lg": "0 4px 8px -2px hsl(240 30% 12% / 0.07), 0 20px 40px -8px hsl(240 30% 12% / 0.12)",
      "--shadow-xl": "0 8px 16px -4px hsl(240 30% 12% / 0.08), 0 32px 64px -12px hsl(240 30% 12% / 0.16)",
      "--shadow-glow": "0 0 0 1px hsl(var(--primary) / 0.10), 0 8px 32px -8px hsl(var(--primary) / 0.35)",
    },
    ".dark": {
      "--shadow-sm": "0 1px 2px 0 hsl(0 0% 0% / 0.30), 0 1px 3px 0 hsl(0 0% 0% / 0.40)",
      "--shadow-md": "0 2px 4px -1px hsl(0 0% 0% / 0.35), 0 8px 16px -4px hsl(0 0% 0% / 0.45)",
      "--shadow-lg": "0 4px 8px -2px hsl(0 0% 0% / 0.40), 0 20px 40px -8px hsl(0 0% 0% / 0.55)",
      "--shadow-xl": "0 8px 16px -4px hsl(0 0% 0% / 0.45), 0 32px 64px -12px hsl(0 0% 0% / 0.65)",
      "--shadow-glow": "0 0 0 1px hsl(var(--primary) / 0.20), 0 8px 40px -8px hsl(var(--primary) / 0.45)",
    },
    // Durable typography hooks. The project-specific identity can override these CSS vars.
    html: { "font-family": "var(--font-sans)", "scroll-behavior": "smooth" },
    body: { "-webkit-font-smoothing": "antialiased", "-moz-osx-font-smoothing": "grayscale" },
    "h1, h2, h3, h4, h5, h6": { "font-family": "var(--font-display)", "font-weight": "700", "letter-spacing": "-0.022em" },
  })
  addComponents({
    ".glass": {
      "background-color": "hsl(var(--background) / 0.65)",
      "backdrop-filter": "saturate(180%) blur(12px)",
      "-webkit-backdrop-filter": "saturate(180%) blur(12px)",
    },
    ".text-gradient": {
      "background-image": "linear-gradient(135deg, hsl(var(--foreground)), hsl(var(--primary)))",
      "-webkit-background-clip": "text",
      "background-clip": "text",
      color: "transparent",
    },
    ".hover-lift": {
      transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s cubic-bezier(0.22,1,0.36,1)",
    },
    ".hover-lift:hover": { transform: "translateY(-4px)", "box-shadow": "var(--shadow-lg)" },
    ".reveal": {
      opacity: "0",
      transform: "translateY(16px)",
      transition: "opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)",
    },
    ".reveal.is-visible": { opacity: "1", transform: "none" },
  })
})

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "IBM Plex Sans Arabic", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "Sora", "IBM Plex Sans Arabic", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
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
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, hsl(var(--border)/0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)/0.5) 1px, transparent 1px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), premiumFoundation],
} satisfies Config
