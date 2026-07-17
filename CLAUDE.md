# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Professional CV/Portfolio landing page plus a self-hosted visit-tracking analytics service. Two independently deployed pieces that share one `docker-compose.yaml` and one Traefik reverse proxy:

1. **Frontend (`src/`)** — Zero-build, zero-dependency vanilla JS static site served by Nginx.
2. **Analytics backend (`backend/`)** — FastAPI + asyncpg service that records visits into PostgreSQL and exposes a stats API and a dashboard.

**Production URLs (all on `devapis.cloud`, routed by path):**
- `/cv` → static CV site
- `/api/track` (POST) → records a visit
- `/api/analytics`, `/api/analytics/recent` → stats JSON
- `/analytics` → HTML dashboard
- `/health` → backend + DB health

## Development Commands

### Frontend — local
```bash
# Serve the static site (no build step)
python -m http.server 8000 --directory src/
# or
npx serve src/
# → http://localhost:8000
```

### Frontend — Docker
```bash
docker build -t landpage .
docker run -p 8080:80 landpage   # → http://localhost:8080
```

### Backend — local
```bash
cd backend
pip install -r requirements.txt
# Requires a reachable PostgreSQL; configure via env vars (see below)
uvicorn main:app --reload --port 8000   # → http://localhost:8000
```

### Full stack — Docker Compose (production)
```bash
docker compose up -d              # builds+runs cv + analytics-api
docker compose logs -f            # all services
docker compose logs -f analytics-api
docker compose restart            # restart both
docker compose down

# Convenience scripts:
./deploy-analytics.sh             # first-time analytics setup (checks postgres17, network, seeds schema, verifies endpoints)
./update-production.sh            # rebuild analytics-api and force-recreate both services
```

### Testing
No automated tests. Manual checklist:
- **Frontend:** theme toggle (light/dark), smooth-scroll nav, certificate modal (click any cert card), PDF export button, responsive layouts, keyboard/screen-reader accessibility.
- **Backend:** `curl https://devapis.cloud/health`, `curl -X POST https://devapis.cloud/api/track`, `curl https://devapis.cloud/api/analytics`.

## Architecture

### Zero-Build Frontend Philosophy
The `src/` frontend intentionally has **no build system** — files are served directly, no transpile/bundle/minify, no npm deps. Edits are reflected on refresh (or container restart). This constraint does **not** apply to the backend, which is a normal Python service.

### Frontend Modules (`src/main.js`)
IIFE modules, each with an `init()` called from a single `init()` on DOM ready. No inter-module dependencies. `data-js="true"` is set on `<html>` once JS loads.

```
ThemeManager   Dark/light mode, localStorage key `cv-color-scheme`
SmoothScroll   Anchor nav with history.pushState
NavHighlight   Active nav link via Intersection Observer
Accessibility  Skip links, ARIA live regions
CertModal      Certificate image lightbox
PDFExport      Print/PDF with forced light theme
PrintHandler   Ctrl+P / Cmd+P shortcut
Analytics      POSTs to https://devapis.cloud/api/track ~1s after load; fails silently
```

The `Analytics` module hardcodes the production `/api/track` URL and swallows all errors so tracking never affects UX. It sends no body — the backend derives everything from request headers.

### Backend Architecture (`backend/main.py`)
Single-file FastAPI app. Key points:

- **Connection pool:** one global `asyncpg` pool created in the `lifespan` handler (`min_size=1, max_size=10`), closed on shutdown.
- **Schema auto-init:** on startup `init_database()` runs `CREATE TABLE IF NOT EXISTS` / indexes / the `cv_analytics_summary` view. This mirrors `database/init-analytics.sql`. **If you change the schema, update both** `main.py`'s DDL and `database/init-analytics.sql`.
- **Visit tracking:** `/api/track` reads client IP from `x-forwarded-for` (Traefik sets this; takes the first IP if comma-separated), parses browser/OS/device from the User-Agent via a hand-rolled `parse_user_agent()` (no external UA library), and inserts a row. Errors return `{"status":"error"}` rather than raising.
- **Timezone:** stored timestamps are UTC; API responses convert display times to Venezuela time (UTC-4) via `to_venezuela_time()`.
- **CORS:** restricted to `https://devapis.cloud` and localhost origins.
- **Data model:** single table `cv_visits` (ip, user_agent, browser, os, device_type, referer, language, visited_at, created_at).

Note: the `/` root endpoint's self-description still advertises `GET /dashboard`, but the actual dashboard route is `/analytics`.

### Deployment Architecture
```
Browser (HTTPS) → Traefik (TLS termination, path routing on devapis.cloud)
    ├─ PathPrefix(/cv)                    → strip /cv → cv (Nginx :80, serves src/)
    └─ PathPrefix(/api) or /analytics     → analytics-api (FastAPI :8000)
```

Both services join the **external `server` Docker network** (must already exist; `docker network create server` if not) and rely on a **PostgreSQL container named `postgres17`** on that same network. Traefik uses cert resolver `resolver` for automatic TLS. Routing labels live in `docker-compose.yaml`; the `/cv` prefix is stripped by the `cv-stripprefix` middleware before reaching Nginx.

**Nginx (`nginx.conf`):** only a `server {}` block (global directives were removed — they conflict with `nginx:1.27-alpine` defaults and caused `duplicate directive` startup crashes; keep it that way). SPA fallback (404→index.html), `index.html` no-cache, assets cached 1y immutable, security headers (CSP restricts scripts to `'self'`, so keep JS in external `main.js`), gzip, `.git`/dotfiles blocked.

## Configuration & Secrets

Unlike the pure-static original, the backend **does use secrets**. `.env` (gitignored) supplies DB credentials consumed by `docker-compose.yaml` → the analytics container:

```
DB_HOST=postgres17
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...
DB_PORT=5432
```

Copy `.env.example` → `.env` and set the real password. Never commit `.env`. See `DEPLOY-ANALYTICS.md` for the full first-deploy runbook and `analytics-backend-proposal.md` for design rationale.

## Code Modification Guidelines

### HTML (`src/index.html`)
Spanish (`lang="es"`), semantic HTML5, ARIA labels, BEM class names.

### CSS (`src/styles.css`)
- BEM naming (`.block__element--modifier`).
- CSS custom properties only — no hardcoded colors. Define token in `:root`, override under `[data-theme="dark"]`.
- Mobile-first: base styles for mobile, `@media (min-width: ...)` for larger. Breakpoints: 380px, 640px, 768px, 1024px.

### JavaScript (`src/main.js`)
- IIFE module with `init()`; register it in the main `init()`.
- No external dependencies.
- Support both `click` and `touchend` for mobile buttons.
- CSP forbids inline scripts — all JS must live in `main.js`.

### Backend (`backend/main.py`)
- Keep it dependency-light (currently only fastapi, uvicorn, asyncpg). Adding a lib means editing `backend/requirements.txt` and rebuilding the image.
- Schema changes: update DDL in `main.py` **and** `database/init-analytics.sql`.
- Acquire connections via `DB_POOL.acquire()`; never open ad-hoc connections.

### Images
Place in `src/assets/images/`, reference relatively (`assets/images/x.png`), set explicit `width`/`height`, descriptive `alt`.

## Important Constraints

- **`-old.*` files** (`*-old.html/css/js` in `src/`) are gitignored backups — ignore them; edit the live `index.html` / `styles.css` / `main.js`.
- **Frontend volumes** are mounted read-only in production; changes require the file to be present in `src/`.
- **Browser support:** ES6+, CSS Grid/Flexbox, Intersection Observer required; no IE11.
- **Performance budget:** keep total frontend page size well under 200KB (currently ~76KB); CSS/JS unminified is acceptable at this size.

## Troubleshooting

**Frontend changes not appearing:** hard-refresh (Ctrl+Shift+R); `docker compose down && up -d`; confirm the file saved in `src/`.

**Traefik routing:** ensure external `server` network exists (`docker network ls`); check `docker logs traefik`; inspect labels with `docker inspect`.

**Backend unhealthy / DB errors:** `/health` returns 503 if the pool can't reach Postgres. Verify the `postgres17` container is up on the `server` network and `.env` credentials are correct; `docker compose logs -f analytics-api`.

**Theme not persisting:** check `localStorage` key `cv-color-scheme` (DevTools → Application → Local Storage).

**PDF export:** uses the browser print dialog; theme is forced light during print — use the print media query for print-only styles.
