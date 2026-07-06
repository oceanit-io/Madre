import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rosa: '#E8396A',
        'rosa-pale': '#FFF0F4',
        'rosa-mist': '#FDE8EE',
        teal: '#0BBFA0',
        'teal-pale': '#E0FAF5',
        'teal-dark': '#089C82',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
