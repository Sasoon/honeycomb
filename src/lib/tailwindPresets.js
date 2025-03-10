// Custom presets for Tailwind CSS v4
export const fontUtilities = {
    utilities: {
        '.font-bold': {
            'font-weight': '700',
        },
        '.font-semibold': {
            'font-weight': '600',
        },
        '.font-medium': {
            'font-weight': '500',
        },
        '.font-normal': {
            'font-weight': '400',
        },
        '.text-xs': {
            'font-size': '0.75rem',
            'line-height': '1rem',
        },
        '.text-sm': {
            'font-size': '0.875rem',
            'line-height': '1.25rem',
        },
        '.text-base': {
            'font-size': '1rem',
            'line-height': '1.5rem',
        },
        '.text-lg': {
            'font-size': '1.125rem',
            'line-height': '1.75rem',
        },
        '.text-xl': {
            'font-size': '1.25rem',
            'line-height': '1.75rem',
        },
        '.text-2xl': {
            'font-size': '1.5rem',
            'line-height': '2rem',
        },
        '.text-3xl': {
            'font-size': '1.875rem',
            'line-height': '2.25rem',
        },
        '.text-4xl': {
            'font-size': '2.25rem',
            'line-height': '2.5rem',
        },
        '.text-center': {
            'text-align': 'center',
        },
        '.text-white': {
            'color': '#ffffff',
        },
        '.text-gray-500': {
            'color': '#6b7280',
        },
        '.text-gray-600': {
            'color': '#4b5563',
        },
        '.text-gray-700': {
            'color': '#374151',
        },
        '.text-gray-800': {
            'color': '#1f2937',
        },
        '.flex': {
            'display': 'flex',
        },
        '.flex-col': {
            'flex-direction': 'column',
        },
        '.space-x-1': {
            '& > * + *': {
                'margin-left': '0.25rem',
            },
        },
        '.space-x-2': {
            '& > * + *': {
                'margin-left': '0.5rem',
            },
        },
        '.space-y-1': {
            '& > * + *': {
                'margin-top': '0.25rem',
            },
        },
        '.space-y-2': {
            '& > * + *': {
                'margin-top': '0.5rem',
            },
        },
    },
}; 