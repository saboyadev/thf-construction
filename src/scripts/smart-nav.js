document.addEventListener('DOMContentLoaded', function () {
	const nav = document.querySelector('[data-nav]')
	const placeholder = document.querySelector('[data-nav-placeholder]')
	const hero = document.querySelector('[data-hero]')
	const mobileMenuButton = document.querySelector('.mobile-btn')
	if (!nav || !placeholder) return

	// Scroll deltas smaller than this are ignored so tiny jitters don't flip the nav
	const DIRECTION_THRESHOLD = 4

	let lastY = window.scrollY
	let ticking = false

	// Point past which the nav is allowed to reappear: the bottom of the hero,
	// or just the nav's own height on pages without a hero
	const showAfter = () =>
		hero ? hero.offsetTop + hero.offsetHeight - nav.offsetHeight : nav.offsetHeight

	// Swap between in-flow and fixed without animating the swap itself
	const setFixed = fixed => {
		nav.classList.add('transition-none')
		if (fixed) {
			placeholder.style.height = `${nav.offsetHeight}px`
			nav.classList.add('fixed', '-translate-y-full')
		} else {
			placeholder.style.height = ''
			nav.classList.remove('fixed', '-translate-y-full')
		}
		void nav.offsetHeight // force reflow so the class swap lands before transitions resume
		nav.classList.remove('transition-none')
	}

	const update = () => {
		ticking = false
		const y = window.scrollY
		const dy = y - lastY
		const menuOpen = mobileMenuButton?.getAttribute('aria-expanded') === 'true'

		// Near the top: let the nav scroll naturally with the hero. The placeholder's
		// offset accounts for the utility bar that sits above the nav on larger screens.
		if (y <= placeholder.offsetTop + nav.offsetHeight) {
			if (nav.classList.contains('fixed')) setFixed(false)
			lastY = y
			return
		}

		if (!nav.classList.contains('fixed')) setFixed(true)

		let show
		if (menuOpen) show = true
		else if (y < showAfter()) show = false
		else if (Math.abs(dy) < DIRECTION_THRESHOLD) return // no meaningful movement; keep current state
		else show = dy > 0 // scrolling down shows the nav, scrolling up hides it

		nav.classList.toggle('-translate-y-full', !show)
		lastY = y
	}

	window.addEventListener(
		'scroll',
		() => {
			if (ticking) return
			ticking = true
			requestAnimationFrame(update)
		},
		{ passive: true },
	)
	window.addEventListener('resize', () => {
		if (nav.classList.contains('fixed')) placeholder.style.height = `${nav.offsetHeight}px`
	})

	update()
})
