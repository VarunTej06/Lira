import { readFileSync } from 'node:fs'
import plugin from 'tailwindcss/plugin'

/**
 * The four status colours (danger, success, warning, info) as shade scales, in src/theme/colorScales.json.
 * Tailwind's own palette is not used: it is the stock rainbow. The old colour names (red, emerald, amber, blue ...) are kept
 * as names, so every class still works, but they resolve to these four scales. A test checks their contrast.
 */
const SCALES = JSON.parse(readFileSync(new URL('./src/theme/colorScales.json', import.meta.url), 'utf8'))
const FAMILIES = {
  danger: ['red', 'rose', 'pink'],
  success: ['green', 'emerald', 'lime'],
  warning: ['amber', 'yellow', 'orange'],
  info: ['blue', 'sky', 'cyan', 'teal'],
}
const colors = Object.fromEntries(Object.entries(FAMILIES).flatMap(([role, names]) => names.map((name) => [name, SCALES[role]])))

const rgbVar = (name) => `rgb(var(--${name}) / <alpha-value>)`

// Greys follow the theme (cream-brown in Fawn, sage in Sorrel, neutral in dark): the shades are variables in index.css
const greys = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [shade, rgbVar(`gray-${shade}`)]))

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}

/**
 * Dark-mode overrides for the soft "tint" utilities (bg-blue-50, border-red-200, text-emerald-700 …).
 * Generated from the status scales above, so any new class in these families is themed automatically.
 */
const darkTintPlugin = plugin(({ addBase }) => {
  const families = Object.keys(colors)
  const rules = {}
  const bgAlpha = { 50: 0.12, 100: 0.18, 200: 0.26 }
  const borderAlpha = { 100: 0.3, 200: 0.38, 300: 0.45 }
  const textShade = { 500: 400, 600: 400, 700: 300, 800: 300, 900: 200, 950: 200 }

  for (const f of families) {
    const c = colors[f]
    if (!c) continue
    const base = hexToRgb(c[400]) // the lighter step, so a tint is visible on a dark page
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
    // Replaces Tailwind's palette instead of adding to it
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      black: '#000000',
      white: '#ffffff',
      ...colors,
      // Design tokens: values live in CSS variables (see index.css) so they flip with the theme
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
      'lira-amber-light': rgbVar('lira-amber-light'),
      'lira-green': SCALES.success[500],
      'lira-green-light': rgbVar('lira-green-light'),
      'lira-red-light': rgbVar('lira-red-light'),
      'lira-teal-light': rgbVar('lira-teal-light'),
    },
    extend: {
      // As text the accent must be readable on the page: yellow is, tomato red and baby blue need a deeper shade
      textColor: { 'lira-blue': rgbVar('lira-blue-text') },
      // Cards are the surface of the theme (cream in Fawn), never a hard white
      backgroundColor: { white: rgbVar('lira-surface') },
      fontFamily: {
        // The device's own interface font, as Instagram, WhatsApp and LinkedIn use: nothing to download, familiar on every device
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
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
        // Corners stay small: nothing is more than 12px, so panels read as cut rather than inflated
        DEFAULT: '0.25rem',
        sm: '0.1875rem',
        md: '0.3125rem',
        lg: '0.4375rem',
        xl: '0.5625rem',
        '2xl': '0.75rem',
        '3xl': '0.75rem',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'sidebar-in': 'sidebarIn 0.14s ease-out',
        // The arrow of the logo: once on load, again on hover (a second name restarts it), and on a loop while starting
        'logo-grow': 'logoGrow 0.7s cubic-bezier(.2,.8,.3,1) both',
        'logo-grow-again': 'logoGrowAgain 0.7s cubic-bezier(.2,.8,.3,1) both',
        'logo-grow-loop': 'logoGrow 1.3s cubic-bezier(.2,.8,.3,1) infinite',
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
        logoGrow: { '0%': { transform: 'scale(0)', opacity: '0' }, '55%': { opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        logoGrowAgain: { '0%': { transform: 'scale(0)', opacity: '0' }, '55%': { opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
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
