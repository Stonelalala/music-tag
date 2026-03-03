/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                app: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    sidebar: 'var(--bg-sidebar)',
                    muted: 'var(--bg-muted)',
                    accent: 'var(--accent-color)',
                    card: 'var(--bg-card)',
                    border: 'var(--border-color)',
                },
            },
            backgroundColor: {
                'slate-900': 'var(--bg-primary)',
                'slate-800': 'var(--bg-secondary)',
                'slate-700': 'var(--bg-muted)',
                'indigo-900': 'var(--bg-primary)',
                'indigo-600': 'var(--accent-button)',
                'indigo-500': 'var(--accent-button-hover)',
                'emerald-600': 'var(--accent-button)',
                'rose-600': 'var(--accent-button)',
                'sky-600': 'var(--accent-button)',
            },
            textColor: {
                'app-primary': 'var(--text-primary)',
                'app-secondary': 'var(--text-secondary)',
                'app-muted': 'var(--text-muted)',
                'app-accent': 'var(--accent-text)',
                'slate-100': 'var(--text-primary)',
                'slate-200': 'var(--text-primary)',
                'slate-300': 'var(--text-primary)',
                'slate-400': 'var(--text-secondary)',
                'slate-500': 'var(--text-muted)',
                'indigo-200': 'var(--text-secondary)',
                'indigo-400': 'var(--accent-text)',
                'emerald-400': 'var(--accent-text)',
                'rose-400': 'var(--accent-text)',
                'sky-400': 'var(--accent-text)',
            },
            borderColor: {
                'slate-700': 'var(--border-color)',
                'slate-600': 'var(--border-color)',
                'slate-800': 'var(--bg-secondary)',
                'indigo-500': 'var(--border-color)',
                'emerald-600': 'var(--border-color)',
                'rose-600': 'var(--border-color)',
                'sky-600': 'var(--border-color)',
            }
        },
    },
    plugins: [],
}
