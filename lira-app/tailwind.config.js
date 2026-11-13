import plugin from 'tailwindcss/plugin'
import colors from 'tailwindcss/colors'

const rgbVar = (name) => `rgb(var(--${name}) / <alpha-value>)`

// Greys follow the theme (cream-brown in Fawn, sage in Sorrel, neutral in dark): the shades are variables in index.css
const greys = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [shade, rgbVar(`gray-${shade}`)]))

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}

/**
 * Dark-mode overrides for the soft "tint" utilities (bg-blue-50, border-red-200, text-emerald-700 …).
 * Generated from Tailwind's own palette, so any new class in these families is themed automatically.
 */
const darkTintPlugin = plugin(({ addBase }) => {
  const families = ['red', 'blue', 'green', 'amber', 'yellow', 'orange', 'indigo', 'purple', 'violet', 'pink', 'teal', 'emerald', 'sky', 'cyan', 'rose', 'fuchsia', 'lime']
  const rules = {}
  const bgAlpha = { 50: 0.12, 100: 0.18, 200: 0.26 }
  const borderAlpha = { 100: 0.3, 200: 0.38, 300: 0.45 }
  const textShade = { 500: 400, 600: 400, 700: 300, 800: 300, 900: 200, 950: 200 }

  for (const f of families) {
    const c = colors[f]
    if (!c) continue
    const base = hexToRgb(c[500])
    for (const [shade, a] of Object.entries(bgAlpha)) {
      const v = { 'background-color': `rgb(${base} / ${a})` }
      const hv = { 'background-color': `rgb(${base} / ${a + 0.06})` }
      rules[`.dark .bg-${f}-${shade}`] = v
      rules[`.dark .hover\\:bg-${f}-${shade}:hover`] = hv
      rules[`.dark .group:hover .group-hover\\:bg-${f}-${shade}`] = hv
      rules[`.dark [class^="bg-${f}-${shade}/"], .dark [class*=" bg-${f}-${shade}/"]`] = { 'background-color': `rgb(${base} / ${a * 0.7})` }
      rules[`.dark [class*="hover:bg-${f}-${shade}/"]:hover`] = { 'background-color': `rgb(${base} / ${a})` }
    }
    for (const [shade, a] of Object.entries(borderAlpha)) {
      rules[`.dark .border-${f}-${shade}`] = { 'border-color': `rgb(${base} / ${a})` }
    }
    for (const [shade, to] of Object.entries(textShade)) {
      if (shade === '500') continue
      rules[`.dark .text-${f}-${shade}`] = { color: c[to] }
      rules[`.dark .hover\\:text-${f}-${shade}:hover`] = { color: c[200] }
      rules[`.dark .group:hover .group-hover\\:text-${f}-${shade}`] = { color: c[200] }
    }
  }
  addBase(rules)
})

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens — values live in CSS variables (see index.css) so they flip with the theme
        'app-frame': rgbVar('app-frame'),
        'lira-bg': rgbVar('lira-bg'),
        'lira-surface': rgbVar('lira-surface'),
        'lira-border': rgbVar('lira-border'),
        'lira-text': rgbVar('lira-text'),
        'lira-muted': rgbVar('lira-muted'),
        'lira-blue': rgbVar('lira-blue'),
        'lira-blue-light': rgbVar('lira-blue-light'),
        'lira-blue-hover': rgbVar('lira-blue-hover'),
        'lira-on-blue': rgbVar('lira-on-blue'),
        'lira-nav': rgbVar('lira-nav'),
        'lira-nav-accent': rgbVar('lira-nav-accent'),
        gray: greys,
        slate: greys,
        'lira-amber': '#FFAB00',
        'lira-amber-light': rgbVar('lira-amber-light'),
        'lira-green': '#36B37E',
        'lira-green-light': rgbVar('lira-green-light'),
        'lira-red': '#DE350B',
        'lira-red-light': rgbVar('lira-red-light'),
        'lira-purple': '#6554C0',
        'lira-purple-light': rgbVar('lira-purple-light'),
        'lira-teal': '#00B8D9',
        'lira-teal-light': rgbVar('lira-teal-light'),
      },
      // As text the accent must be readable on the page: yellow is, tomato red and baby blue need a deeper shade
      textColor: { 'lira-blue': rgbVar('lira-blue-text') },
      // Cards are the surface of the theme (cream in Fawn), never a hard white
      backgroundColor: { white: rgbVar('lira-surface') },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // The small end of the type scale (pixel sizes the default scale does not have)
      fontSize: {
        '4xs': '9px',
        '3xs': '10px',
        '3xs-plus': '10.5px',
        '2xs': '11px',
        ui: '13px',
      },
      borderRadius: {
        // Softer corners app-wide: bump the whole scale one notch
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.14), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 6px 16px rgba(0, 0, 0, 0.14)',
        'modal': '0 12px 40px rgba(0, 0, 0, 0.28)',
        'dropdown': '0 8px 20px -4px rgba(0, 0, 0, 0.22)',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'sidebar-in': 'sidebarIn 0.35s cubic-bezier(.4,0,.2,1)',
        'chat-pop': 'chatPop 0.42s cubic-bezier(.22,1,.36,1) both',
        'chat-out': 'chatOut 0.3s cubic-bezier(.5,0,.75,0) forwards',
        'msg-in': 'msgIn 0.35s cubic-bezier(.2,.8,.3,1) both',
      },
      keyframes: {
        chatPop: {
          "0%": { opacity: "0", transform: "scale(0.04)", borderRadius: "9999px" },
          "55%": { opacity: "1" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        chatOut: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "60%": { opacity: "0.9" },
          "100%": { opacity: "0", transform: "scale(0.04)" },
        },
        msgIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sidebarIn: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideIn: {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [darkTintPlugin],
}
