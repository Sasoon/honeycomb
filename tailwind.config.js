// Theme colours are CSS variables; wrap them so Tailwind can apply <alpha-value>
const v = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // color-mix keeps index.css the single source of truth while letting
            // opacity modifiers (bg-amber/10, border-secondary/30...) compile
            colors: {
                primary: { DEFAULT: v('primary'), light: v('primary-light'), dark: v('primary-dark') },
                secondary: { DEFAULT: v('secondary'), light: v('secondary-light'), dark: v('secondary-dark') },
                accent: { DEFAULT: v('accent'), light: v('accent-light'), dark: v('accent-dark') },
                highlight: { DEFAULT: v('highlight'), light: v('highlight-light'), dark: v('highlight-dark') },
                success: { DEFAULT: v('success'), light: v('success-light'), dark: v('success-dark') },
                gold: v('gold'),
                amber: { DEFAULT: v('amber'), light: v('amber-light'), dark: v('amber-dark') },
                'color-1': v('color-1'),
                'color-2': v('color-2'),
                'color-3': v('color-3'),
                'color-4': v('color-4'),
                'color-5': v('color-5'),
                'bg-primary': v('bg-primary'),
                'bg-secondary': v('bg-secondary'),
                'text-primary': v('text-primary'),
                'text-secondary': v('text-secondary'),
                'text-muted': v('text-muted'),
                // Neutral hairlines and surfaces on the Abyss background
                line: 'rgba(190, 210, 235, 0.12)',
                'line-strong': 'rgba(190, 210, 235, 0.2)',
                surface: 'rgba(190, 210, 235, 0.08)',
                'surface-hover': 'rgba(190, 210, 235, 0.14)',
            },
            fontFamily: {
                game: ['Poppins', 'sans-serif'],
            },
            fontSize: {
                'xs': ['0.75rem', '1rem'],
                'sm': ['0.875rem', '1.25rem'],
                'base': ['1rem', '1.5rem'],
                'lg': ['1.125rem', '1.75rem'],
                'xl': ['1.25rem', '1.75rem'],
                '2xl': ['1.5rem', '2rem'],
                '3xl': ['1.875rem', '2.25rem'],
                '4xl': ['2.25rem', '2.5rem'],
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.font-bold': { 'font-weight': '700' },
                '.font-semibold': { 'font-weight': '600' },
                '.font-medium': { 'font-weight': '500' },
                '.font-normal': { 'font-weight': '400' },
                '.text-xs': { 'font-size': '0.75rem', 'line-height': '1rem' },
                '.text-sm': { 'font-size': '0.875rem', 'line-height': '1.25rem' },
                '.text-base': { 'font-size': '1rem', 'line-height': '1.5rem' },
                '.text-lg': { 'font-size': '1.125rem', 'line-height': '1.75rem' },
                '.text-xl': { 'font-size': '1.25rem', 'line-height': '1.75rem' },
                '.text-2xl': { 'font-size': '1.5rem', 'line-height': '2rem' },
                '.text-3xl': { 'font-size': '1.875rem', 'line-height': '2.25rem' },
                '.text-4xl': { 'font-size': '2.25rem', 'line-height': '2.5rem' },
                '.text-center': { 'text-align': 'center' },
                '.text-white': { 'color': '#ffffff' },
                '.text-gray-500': { 'color': '#6b7280' },
                '.text-gray-600': { 'color': '#4b5563' },
                '.text-gray-800': { 'color': '#1f2937' },
            });
        },
    ],
}
