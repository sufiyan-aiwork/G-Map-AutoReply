/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        tz: {
          navy: '#001f3f',
          'navy-light': '#012b55',
          'navy-dark': '#00142b',
          blue: '#025091',
          'blue-hover': '#023e73',
          'blue-deep': '#013460',
          'blue-soft': '#e8f1f8',
          cyan: '#00d2ff',
          'cyan-soft': '#00f2fe',
          ink: '#1a1a2e',
          muted: '#64748b',
          canvas: '#f6f9fc',
          border: '#e2e8f0',
        },
        navy: {
          50: '#eef4fa',
          100: '#d7e5f3',
          200: '#acc7e3',
          700: '#013460',
          800: '#012b55',
          900: '#001f3f',
          950: '#00142b',
        },
        brand: {
          50: '#eff6fb',
          100: '#dcebf7',
          200: '#b9d7ef',
          500: '#0263b4',
          600: '#025091',
          700: '#023e73',
          800: '#013460',
          900: '#001f3f',
        },
      },
      boxShadow: {
        'tz-card': '0 2px 12px rgba(2, 80, 145, 0.04), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'tz-card-hover': '0 10px 26px rgba(2, 80, 145, 0.09), 0 2px 6px rgba(15, 23, 42, 0.05)',
      },
    },
  },
  plugins: [],
};
