// tailwind.config.js
module.exports = {
  content: [
    './index.html', 
    './src/**/*.{js,jsx,ts,tsx,vue,html}', 
    // etc. adjust as needed
  ],
  theme: {
    extend: {
      fontFamily: {
        // For body text (regular Cinzel)
        cinzel: ['Cinzel', 'serif'],
        // For headers (Cinzel Decorative)
        cinzelDecorative: ['Cinzel Decorative', 'serif'],
      },
    },
  },
  plugins: [],
}
