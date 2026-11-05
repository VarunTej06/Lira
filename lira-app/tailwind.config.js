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
        // Atlassian Design System tokens
        'jira-bg': '#F4F5F7',
        'jira-surface': '#FFFFFF',
        'jira-border': '#DFE1E6',
        'jira-text': '#172B4D',
        'jira-muted': '#6B778C',
        'jira-blue': '#0052CC',
        'jira-blue-light': '#DEEBFF',
        'jira-blue-hover': '#0065FF',
        'jira-amber': '#FFAB00',
        'jira-amber-light': '#FFF7D6',
        'jira-green': '#36B37E',
        'jira-green-light': '#E3FCEF',
        'jira-red': '#DE350B',
        'jira-red-light': '#FFEBE6',
        'jira-purple': '#6554C0',
        'jira-purple-light': '#EAE6FF',
        'jira-teal': '#00B8D9',
        'jira-teal-light': '#E6FCFF',
        // Nav colors
        'nav-bg': '#0747A6',
        'nav-sidebar': '#1A2332',
        'nav-sidebar-hover': '#253148',
        'nav-sidebar-active': '#0052CC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(9, 30, 66, 0.25)',
        'card-hover': '0 4px 8px rgba(9, 30, 66, 0.25)',
        'modal': '0 8px 32px rgba(9, 30, 66, 0.32)',
        'dropdown': '0 4px 8px -2px rgba(9, 30, 66, 0.25)',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
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
  plugins: [],
}
