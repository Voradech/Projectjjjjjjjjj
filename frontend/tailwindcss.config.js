/**  @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages//.{js,ts,jsx,tsx}",
    "./components/**/.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🔹 นี่คือส่วนที่ทำให้ bg-navy-950 ทำงานครับ
        navy: {
          950: '#020617', 
          900: '#0B1120',
          800: '#151e32',
          700: '#1E293B',
        },
        accent: {
          DEFAULT: '#10B981',
          glow: '#34D399',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}