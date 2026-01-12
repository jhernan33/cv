/**
 * CV PROFESIONAL - JavaScript
 * ============================
 * Funcionalidad mínima y esencial
 * Sin dependencias externas
 */

(function() {
	'use strict';

	/* ============================================
	   THEME TOGGLE (Light/Dark Mode)
	   ============================================ */
	
	const ThemeManager = {
		STORAGE_KEY: 'cv-color-scheme',
		
		init() {
			this.toggle = document.getElementById('theme-toggle');
			if (!this.toggle) return;
			
			this.loadTheme();
			this.toggle.addEventListener('click', () => this.switchTheme());
		},
		
		loadTheme() {
			const saved = localStorage.getItem(this.STORAGE_KEY);
			if (saved) {
				document.documentElement.setAttribute('data-theme', saved);
			}
		},
		
		switchTheme() {
			const current = document.documentElement.getAttribute('data-theme');
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			
			let next;
			if (current === 'dark') {
				next = 'light';
			} else if (current === 'light') {
				next = 'dark';
			} else {
				next = prefersDark ? 'light' : 'dark';
			}
			
			document.documentElement.setAttribute('data-theme', next);
			localStorage.setItem(this.STORAGE_KEY, next);
		}
	};

	/* ============================================
	   SMOOTH SCROLL
	   ============================================ */
	
	const SmoothScroll = {
		init() {
			document.querySelectorAll('a[href^="#"]').forEach(link => {
				link.addEventListener('click', (e) => {
					const href = link.getAttribute('href');
					if (href === '#') return;
					
					const target = document.querySelector(href);
					if (!target) return;
					
					e.preventDefault();
					target.scrollIntoView({ behavior: 'smooth', block: 'start' });
					history.pushState(null, '', href);
				});
			});
		}
	};

	/* ============================================
	   NAV ACTIVE STATE
	   ============================================ */
	
	const NavHighlight = {
		init() {
			this.links = document.querySelectorAll('.nav__link');
			this.sections = document.querySelectorAll('section[id]');
			
			if (!this.links.length || !this.sections.length) return;
			
			const observer = new IntersectionObserver(
				(entries) => this.handleIntersect(entries),
				{ rootMargin: '-20% 0px -60% 0px' }
			);
			
			this.sections.forEach(section => observer.observe(section));
		},
		
		handleIntersect(entries) {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const id = entry.target.getAttribute('id');
					this.setActive(id);
				}
			});
		},
		
		setActive(id) {
			this.links.forEach(link => {
				const href = link.getAttribute('href');
				if (href === `#${id}`) {
					link.classList.add('nav__link--active');
				} else {
					link.classList.remove('nav__link--active');
				}
			});
		}
	};

	/* ============================================
	   ACCESSIBILITY
	   ============================================ */
	
	const Accessibility = {
		init() {
			// Skip link enhancement
			const skipLink = document.querySelector('.skip-link');
			if (skipLink) {
				skipLink.addEventListener('click', (e) => {
					e.preventDefault();
					const main = document.querySelector('#main');
					if (main) {
						main.focus();
						main.scrollIntoView({ behavior: 'smooth' });
					}
				});
			}
			
			// Announce live region for screen readers
			this.createLiveRegion();
		},
		
		createLiveRegion() {
			const region = document.createElement('div');
			region.setAttribute('aria-live', 'polite');
			region.setAttribute('aria-atomic', 'true');
			region.className = 'sr-only';
			document.body.appendChild(region);
			this.liveRegion = region;
		},
		
		announce(message) {
			if (this.liveRegion) {
				this.liveRegion.textContent = message;
			}
		}
	};

	/* ============================================
	   PRINT HANDLER
	   ============================================ */
	
	const PrintHandler = {
		init() {
			document.addEventListener('keydown', (e) => {
				if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
					e.preventDefault();
					window.print();
				}
			});
		}
	};

	/* ============================================
	   INIT
	   ============================================ */
	
	function init() {
		ThemeManager.init();
		SmoothScroll.init();
		NavHighlight.init();
		Accessibility.init();
		PrintHandler.init();
		
		// Mark JS as enabled
		document.documentElement.setAttribute('data-js', 'true');
	}

	// Run on DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
