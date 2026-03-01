/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        scada: {
          bg: '#0F172A',
          panel: '#1E293B',
          border: '#334155',
          text: '#E2E8F0',
          accent: '#3B82F6',
          success: '#16A34A',
          warning: '#EAB308',
          danger: '#DC2626',
          orange: '#F97316',
        },
        public: {
          bg: '#FFFFFF',
          surface: '#F8FAFC',
          border: '#E2E8F0',
          text: '#1E293B',
          muted: '#64748B',
          accent: '#2563EB',
          'accent-light': '#DBEAFE',
          success: '#059669',
          warning: '#D97706',
          danger: '#DC2626',
        },
        voltage: {
          '132kv': '#1E40AF',
          '33kv': '#DC2626',
          '11kv': '#16A34A',
          deenergized: '#6B7280',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.6s ease-out forwards',
        'fade-in-delayed': 'fadeIn 0.8s ease-out 0.3s forwards',
        'fade-in-delayed-2': 'fadeIn 0.8s ease-out 0.6s forwards',
        'bounce-slow': 'bounceSlow 2s ease-in-out infinite',
        'float-1': 'float1 3s ease-in-out infinite',
        'float-2': 'float2 3.5s ease-in-out infinite',
        'float-3': 'float3 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        float1: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(3deg)' },
        },
        float2: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(-3deg)' },
        },
        float3: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-5px) rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};
