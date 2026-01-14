# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Professional CV/Portfolio landing page deployed as a static site. Zero-build, zero-dependency vanilla JavaScript project served via Nginx in Docker with Traefik reverse proxy.

**Production URL:** https://devapis.cloud/cv

## Development Commands

### Local Development
```bash
# Serve locally with any static server
python -m http.server 8000 --directory src/
# or
npx serve src/

# Access at http://localhost:8000
```

### Docker Development
```bash
# Build and run locally
docker build -t landpage .
docker run -p 8080:80 landpage

# Access at http://localhost:8080
```

### Production Deployment
```bash
# Deploy with Docker Compose (requires external 'server' network and Traefik)
docker compose up -d

# View logs
docker compose logs -f

# Restart service
docker compose restart

# Stop and remove
docker compose down
```

### Testing
No automated tests. Manual testing checklist:
- Theme toggle (light/dark)
- Smooth scroll navigation
- Certificate modal (click any cert card)
- PDF export button
- Responsive layouts (mobile, tablet, desktop)
- Accessibility (keyboard navigation, screen reader)

## Architecture

### Zero-Build Philosophy
This project intentionally has **no build system**. Source files in `src/` are served directly:
- No transpilation
- No bundling
- No minification
- No npm dependencies

Changes to HTML/CSS/JS are immediately reflected (refresh browser or restart container).

### Frontend Architecture (Vanilla JS Modules)

JavaScript is organized as IIFE modules in `src/main.js`:

```javascript
ThemeManager      // Dark/light mode with localStorage persistence
SmoothScroll      // Anchor navigation with history.pushState
NavHighlight      // Active nav link via Intersection Observer
Accessibility     // Skip links, ARIA live regions
CertModal         // Certificate image lightbox
PDFExport         // Print/PDF generation with forced light theme
PrintHandler      // Ctrl+P / Cmd+P keyboard shortcut
```

Each module has `init()` method called on DOMContentLoaded. Modules are self-contained with no inter-module dependencies.

### CSS Architecture

**Methodology:** BEM (Block Element Modifier)
- Blocks: `.nav`, `.hero`, `.timeline`, `.cert-card`
- Elements: `.nav__link`, `.hero__title`, `.timeline__item`
- Modifiers: `.nav__link--active`, `.nav__btn--pdf`

**Theming:** CSS Custom Properties with `[data-theme="dark"]` override
- Design tokens defined in `:root`
- Dark mode overrides in `[data-theme="dark"]`
- System preference detected, user choice persisted

**Layout Strategy:**
- Mobile-first responsive design
- CSS Grid for complex layouts (hero, certifications)
- Flexbox for linear layouts (nav, timeline)
- Breakpoints: 380px, 640px, 768px, 1024px

### Deployment Architecture

```
Browser (HTTPS)
    ↓
Traefik (reverse proxy, TLS termination)
    ↓ strips /cv prefix
Nginx Container (port 80, internal)
    ↓ serves from /usr/share/nginx/html
Static Files (src/ mounted read-only)
```

**Traefik Configuration:**
- Host: `devapis.cloud`
- PathPrefix: `/cv`
- Middleware: `cv-stripprefix` removes `/cv` before forwarding to Nginx
- TLS: Automatic via cert resolver
- Network: External `server` network (must exist)

**Nginx Configuration Highlights:**
- SPA routing: All 404s → `index.html`
- Cache strategy:
  - `index.html`: No cache (`must-revalidate`)
  - Assets (images, CSS, JS): 1 year immutable cache
- Security headers: CSP, X-Frame-Options, HSTS
- Gzip compression enabled
- `.git` directory blocked

## Code Modification Guidelines

### HTML Changes (`src/index.html`)
- Language: Spanish (lang="es")
- Use semantic HTML5 tags
- Add ARIA labels for accessibility
- Maintain BEM class naming

### CSS Changes (`src/styles.css`)
- Follow BEM naming
- Use CSS custom properties (no hardcoded colors)
- Add dark mode support: duplicate rules under `[data-theme="dark"]`
- Mobile-first: base styles for mobile, `@media (min-width: ...)` for desktop

### JavaScript Changes (`src/main.js`)
- Use IIFE module pattern
- No external dependencies allowed
- Add new modules with `init()` method
- Call module in main `init()` function
- Support both `click` and `touchend` events for mobile
- Set `data-js="true"` attribute when JS loads

### Adding Images
1. Place in `src/assets/images/`
2. Reference with relative path: `assets/images/filename.ext`
3. Add `width` and `height` attributes explicitly
4. Use descriptive `alt` text

### Nginx Configuration Changes
Edit `nginx.conf` and restart container:
```bash
docker compose restart
```

## Important Constraints

### Security
- All volumes mounted **read-only** (`:ro`) in production
- CSP policy restricts inline scripts (use external `main.js`)
- No environment variables with secrets (static site only)

### Browser Compatibility
- ES6+ JavaScript (no transpilation)
- CSS Grid and Flexbox required
- Intersection Observer API required
- No IE11 support

### Performance
- Keep total page size under 200KB (currently ~76KB)
- Images should be optimized (consider WebP)
- CSS/JS files are not minified (acceptable for this size)

## Common Patterns

### Adding a New Section
1. Add `<section id="new-section">` in HTML
2. Add nav link: `<a href="#new-section" class="nav__link">`
3. NavHighlight will auto-detect and highlight
4. Add section styles in CSS following BEM

### Adding a New Module
```javascript
const NewModule = {
    init() {
        // Setup code
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Event handlers
    }
};

// Add to main init()
function init() {
    // ...existing modules...
    NewModule.init();
}
```

### Dark Mode Support
```css
:root {
    --color-example: #0ea5e9;
}

[data-theme="dark"] {
    --color-example: #38bdf8;
}
```

## Troubleshooting

### Changes not appearing
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Check volume mount: `docker compose down && docker compose up -d`
3. Verify file saved in `src/` directory

### Traefik routing issues
1. Ensure external `server` network exists: `docker network ls`
2. Check Traefik logs: `docker logs traefik`
3. Verify labels: `docker inspect landpage | grep traefik`

### Theme not persisting
Check localStorage key `cv-color-scheme` in browser DevTools → Application → Local Storage

### PDF export issues
- PDF export uses browser print dialog
- Theme is forced to light mode during print
- Use print CSS media query for print-specific styles
