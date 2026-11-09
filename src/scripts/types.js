import Typed from 'typed.js'

document.addEventListener('DOMContentLoaded', function () {
	// Only the homepage hero has a .typed target; skip on pages like /thanks.
	if (!document.querySelector('.typed')) return

	new Typed('.typed', {
		strings: ['home', 'kitchen', 'bathroom', 'basement', 'outdoor', 'attic'],
		typeSpeed: 80,
		loop: true,
		backSpeed: 30,
		cursorChar: '|',
		smartBackspace: false,
		backDelay: 1200,
	})
})
