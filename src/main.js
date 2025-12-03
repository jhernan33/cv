/**
 * LANDPAGE CV - Main JavaScript
 * ================================================
 * Frontend Senior - UX/UI Design
 * Methodology: Modular Architecture
 * Principles: SOLID, DRY, Clean Code
 * ================================================
 */

// ============================================
// 1. UTILITIES
// ============================================

/**
 * Utilidad para ejecutar c�digo despu�s del DOM listo
 * @param {Function} callback - Funci�n a ejecutar
 */
const onDOMReady = (callback) => {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', callback);
	} else {
		callback();
	}
};

/**
 * Utilidad para debounce
 * @param {Function} func - Funci�n a debounce
 * @param {Number} wait - Tiempo en ms
 * @returns {Function} Funci�n debouncida
 */
const debounce = (func, wait = 300) => {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

/**
 * Utilidad para throttle
 * @param {Function} func - Funci�n a throttle
 * @param {Number} limit - Tiempo en ms
 * @returns {Function} Funci�n throttled
 */
const throttle = (func, limit = 300) => {
	let inThrottle;
	return function (...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
};

// ============================================
// 2. SMOOTH SCROLL
// ============================================

/**
 * M�dulo: Navegaci�n con Smooth Scroll
 * Permite navegar a secciones con scroll suave
 */
const SmoothScroll = {
	init() {
		this.setupAnchorLinks();
	},

	setupAnchorLinks() {
		// Obtener todos los links internos
		const internalLinks = document.querySelectorAll('a[href^="#"]');

		internalLinks.forEach((link) => {
			link.addEventListener('click', (e) => {
				const href = link.getAttribute('href');

				// Skip si es el skip link
				if (href === '#' || href === '#main-content') {
					return;
				}

				e.preventDefault();

				const target = document.querySelector(href);
				if (!target) return;

				// Smooth scroll
				target.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});

				// Focus en el target para accesibilidad
				target.focus({ preventScroll: true });

				// Cambiar URL sin reload
				window.history.pushState(null, null, href);
			});
		});
	},
};

// ============================================
// 3. PRINT ENHANCEMENTS
// ============================================

/**
 * M�dulo: Mejoras para Impresi�n
 * Detecta intenci�n de impresi�n y agrega hints
 */
const PrintHandler = {
	init() {
		this.setupPrintShortcut();
		this.setupPrintMediaQuery();
	},

	setupPrintShortcut() {
		document.addEventListener('keydown', (e) => {
			// Ctrl+P o Cmd+P
			if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
				e.preventDefault();
				window.print();
			}
		});
	},

	setupPrintMediaQuery() {
		// Detectar cambio a modo impresi�n
		const printMediaQuery = window.matchMedia('print');

		printMediaQuery.addEventListener('change', (e) => {
			if (e.matches) {
				// Entering print mode
				this.onPrintStart();
			} else {
				// Exiting print mode
				this.onPrintEnd();
			}
		});
	},

	onPrintStart() {
		// Agregar clase para estilos especiales de impresi�n si es necesario
		document.documentElement.setAttribute('data-printing', 'true');
	},

	onPrintEnd() {
		// Remover clase cuando termina impresi�n
		document.documentElement.removeAttribute('data-printing');
	},
};

// ============================================
// 4. DARK MODE
// ============================================

/**
 * M�dulo: Soporte para Dark Mode
 * Detecta preferencia del sistema y permite toggle manual
 */
const DarkMode = {
	STORAGE_KEY: 'cv-theme-preference',
	DARK_CLASS: 'theme-dark',

	init() {
		this.detectSystemPreference();
		this.setupMediaQuery();
		this.setupToggleButton();
	},

	detectSystemPreference() {
		const saved = localStorage.getItem(this.STORAGE_KEY);

		// Si hay preferencia guardada, usarla
		if (saved) {
			this.applyTheme(saved);
			return;
		}

		// Si no, detectar preferencia del sistema
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
		this.applyTheme(prefersDark.matches ? 'dark' : 'light');
	},

	setupMediaQuery() {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

		prefersDark.addEventListener('change', (e) => {
			// Solo aplicar si no hay preferencia guardada
			if (!localStorage.getItem(this.STORAGE_KEY)) {
				this.applyTheme(e.matches ? 'dark' : 'light');
			}
		});
	},

	setupToggleButton() {
		// Preparado para agregar bot�n de toggle en el futuro
		// const toggleBtn = document.querySelector('[data-toggle-theme]');
		// if (toggleBtn) {
		//   toggleBtn.addEventListener('click', () => this.toggle());
		// }
	},

	applyTheme(theme) {
		if (theme === 'dark') {
			document.documentElement.classList.add(this.DARK_CLASS);
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.classList.remove(this.DARK_CLASS);
			document.documentElement.setAttribute('data-theme', 'light');
		}

		localStorage.setItem(this.STORAGE_KEY, theme);
	},

	toggle() {
		const current = localStorage.getItem(this.STORAGE_KEY) || 'light';
		const next = current === 'dark' ? 'light' : 'dark';
		this.applyTheme(next);
	},
};

// ============================================
// 5. THEME SELECTOR
// ============================================

/**
 * Módulo: Selector de Temas
 * Permite cambiar entre paletas de colores
 */
const ThemeSelector = {
	STORAGE_KEY: 'cv-theme',
	DEFAULT_THEME: 'modern-tech',
	THEMES: {
		'modern-tech': { name: 'Modern Tech', color: '#2563eb' },
		'executive-elite': { name: 'Executive Elite', color: '#1f2937' },
		'modern-minimal': { name: 'Modern Minimal', color: '#047857' },
		'crimson-pro': { name: 'Crimson Professional', color: '#dc2626' },
		'slate-modern': { name: 'Slate Modern', color: '#475569' },
	},

	init() {
		this.loadTheme();
		this.setupToggle();
		this.setupOptions();
	},

	loadTheme() {
		// Obtener tema guardado o usar default
		const saved = localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_THEME;
		this.setTheme(saved, false);
	},

	setupToggle() {
		const toggle = document.querySelector('.theme-toggle');
		if (!toggle) return;

		toggle.addEventListener('click', () => {
			const menu = document.querySelector('.theme-menu');
			if (menu) {
				menu.toggleAttribute('hidden');
			}
		});

		// Cerrar menú al hacer click fuera
		document.addEventListener('click', (e) => {
			const selector = document.querySelector('.theme-selector');
			const menu = document.querySelector('.theme-menu');
			if (selector && !selector.contains(e.target) && menu) {
				menu.setAttribute('hidden', '');
			}
		});
	},

	setupOptions() {
		const options = document.querySelectorAll('.theme-option');

		options.forEach((option) => {
			option.addEventListener('click', () => {
				const theme = option.getAttribute('data-theme');
				this.setTheme(theme, true);

				// Cerrar menú
				const menu = document.querySelector('.theme-menu');
				if (menu) {
					menu.setAttribute('hidden', '');
				}

				// Anunciar cambio
				Accessibility.announce(`Tema cambiado a ${this.THEMES[theme].name}`);
			});
		});

		// Marcar tema activo
		this.updateActiveOption();
	},

	setTheme(theme, save = true) {
		if (!this.THEMES[theme]) {
			console.warn(`Tema desconocido: ${theme}`);
			return;
		}

		// Cambiar atributo data-theme en HTML
		document.documentElement.setAttribute('data-theme', theme);

		// Guardar preferencia
		if (save) {
			localStorage.setItem(this.STORAGE_KEY, theme);
		}

		// Actualizar opción activa
		this.updateActiveOption();

		console.log(`✨ Tema cambiado a: ${this.THEMES[theme].name}`);
	},

	updateActiveOption() {
		const currentTheme = document.documentElement.getAttribute('data-theme');
		const options = document.querySelectorAll('.theme-option');

		options.forEach((option) => {
			const optionTheme = option.getAttribute('data-theme');
			if (optionTheme === currentTheme) {
				option.classList.add('active');
			} else {
				option.classList.remove('active');
			}
		});
	},
};

// ============================================
// 5. ACCESSIBILITY
// ============================================

/**
 * M�dulo: Mejoras de Accesibilidad
 * Mejora navegaci�n por teclado y otros
 */
const Accessibility = {
	init() {
		this.improveSkipLink();
		this.enhanceKeyboardNavigation();
		this.announceUpdates();
	},

	improveSkipLink() {
		const skipLink = document.querySelector('.skip-link');
		if (!skipLink) return;

		skipLink.addEventListener('click', (e) => {
			e.preventDefault();
			const main = document.querySelector('#main-content');
			if (main) {
				main.focus();
				main.scrollIntoView({ behavior: 'smooth' });
			}
		});
	},

	enhanceKeyboardNavigation() {
		// Asegurar que todos los focusable elements sean accesibles
		document.addEventListener('keydown', (e) => {
			// Permitir navegaci�n por Tab
			if (e.key === 'Tab') {
				// El navegador maneja esto autom�ticamente
				// Este es solo un hook para l�gica adicional si es necesaria
			}
		});
	},

	announceUpdates() {
		// Crear region ARIA live para anuncios
		const liveRegion = document.createElement('div');
		liveRegion.setAttribute('aria-live', 'polite');
		liveRegion.setAttribute('aria-atomic', 'true');
		liveRegion.className = 'sr-only';
		document.body.appendChild(liveRegion);

		// Guardar referencia para usar despu�s
		this.liveRegion = liveRegion;
	},

	announce(message) {
		if (this.liveRegion) {
			this.liveRegion.textContent = message;
		}
	},
};

// ============================================
// 6. PERFORMANCE
// ============================================

/**
 * M�dulo: Optimizaci�n de Rendimiento
 * Mejora performance del sitio
 */
const Performance = {
	init() {
		this.lazyLoadImages();
		this.observeResourceTiming();
	},

	lazyLoadImages() {
		// Si el navegador soporta Intersection Observer
		if ('IntersectionObserver' in window) {
			const images = document.querySelectorAll('img[loading="lazy"]');
			const imageObserver = new IntersectionObserver((entries, observer) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const img = entry.target;
						img.src = img.dataset.src;
						img.classList.add('loaded');
						observer.unobserve(img);
					}
				});
			});

			images.forEach((img) => imageObserver.observe(img));
		}
	},

	observeResourceTiming() {
		// Loguear m�trica de performance (si es necesario en dev)
		if (window.performance && window.performance.timing) {
			const perfData = window.performance.timing;
			const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
			console.log('=� Page Load Time:', pageLoadTime, 'ms');
		}
	},
};

// ============================================
// 7. CONTACT ENHANCEMENTS
// ============================================

/**
 * M�dulo: Mejoras en Informaci�n de Contacto
 * Facilita copia y interacci�n
 */
const ContactEnhancements = {
	init() {
		this.setupContactLinks();
		this.setupCopyToClipboard();
	},

	setupContactLinks() {
		const contactLinks = document.querySelectorAll('.contact-link');

		contactLinks.forEach((link) => {
			const href = link.getAttribute('href');

			// Agregar aria-label mejorado
			if (href.startsWith('mailto:')) {
				const email = href.replace('mailto:', '');
				link.setAttribute('aria-label', `Enviar correo a ${email}`);
			} else if (href.startsWith('tel:')) {
				const phone = link.textContent;
				link.setAttribute('aria-label', `Llamar a ${phone}`);
			}
		});
	},

	setupCopyToClipboard() {
		// Preparado para agregar botones de copia en el futuro
		// Este es un hook para extensibilidad
	},

	copyToClipboard(text) {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(text).then(() => {
				Accessibility.announce(`${text} copiado al portapapeles`);
			});
		}
	},
};

// ============================================
// 8. INIT
// ============================================

onDOMReady(() => {
	console.log('=� Initializing CV application...');

	// Inicializar todos los m�dulos
	try {
		ThemeSelector.init();
		console.log('✓ Theme Selector initialized');

		SmoothScroll.init();
		console.log(' Smooth Scroll initialized');

		PrintHandler.init();
		console.log(' Print Handler initialized');

		DarkMode.init();
		console.log(' Dark Mode initialized');

		Accessibility.init();
		console.log(' Accessibility features initialized');

		Performance.init();
		console.log(' Performance optimizations initialized');

		ContactEnhancements.init();
		console.log(' Contact enhancements initialized');

		console.log(' CV application ready!');
	} catch (error) {
		console.error('L Error initializing application:', error);
	}
});

// ============================================
// 9. PROGRESSIVE ENHANCEMENT
// ============================================

// Si JavaScript est� deshabilitado, el sitio sigue siendo funcional
// Los estilos CSS manejan todo lo necesario

// Agregar indicador de que JS est� cargado
document.documentElement.setAttribute('data-js-enabled', 'true');

// Remover clase 'no-js' si existe
document.documentElement.classList.remove('no-js');
