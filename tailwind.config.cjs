/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				main: '#F58634',
				'main-hover': '#E0701F',
				'main-soft': '#FBE3D0',
				'my-black': '#20262E',
				'dark-metallic': '#333B44',
				metallic: '#5F6773',
				'wolf-gray': '#757980',
				gray: '#929CA6',
				'light-gray': '#F0F1F2',
				'egg-white': '#F7F9FA',
				rule: '#D7D8D9',
			},
			animation: {
				'img-slider': 'img-slider 150s linear infinite',
			},
			keyframes: {
				'img-slider': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(-3900px)' },
				},
			},
		},
	},
	plugins: [],
}
