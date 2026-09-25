import Typed from 'typed.js'

document.addEventListener('DOMContentLoaded', function () {
	var typed = new Typed('.typed', {
		strings: ['home', 'kitchen', 'bathroom', 'basement', 'outdoor', 'attic'],
		typeSpeed: 80,
		loop: true,
		backSpeed: 30,
		cursorChar: '|',
		smartBackspace: false,
		backDelay: 1200,
	})
})
