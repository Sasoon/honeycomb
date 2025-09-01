/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                waxle: {
                    light: '#FFF8E1',
                    DEFAULT: '#FFC107',
                    dark: '#FF9800',
                },
                // Keep honeycomb colors for backwards compatibility during transition
                honeycomb: {
                    light: '#FFF8E1',
                    DEFAULT: '#FFC107',
                    dark: '#FF9800',
                }
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
