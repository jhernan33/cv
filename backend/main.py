"""
CV Analytics API
================
FastAPI backend para tracking de visitas al CV
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from datetime import datetime, timedelta, timezone
import asyncpg
import os
from contextlib import asynccontextmanager

# Variable global para el pool de conexiones
DB_POOL = None


async def init_database():
    """Inicializar la base de datos creando la tabla si no existe"""
    global DB_POOL

    DDL_SCRIPT = """
    -- Tabla de visitas
    CREATE TABLE IF NOT EXISTS cv_visits (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        browser VARCHAR(100),
        os VARCHAR(100),
        device_type VARCHAR(20),
        referer TEXT,
        language VARCHAR(50),
        visited_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Índices para mejorar performance de queries
    CREATE INDEX IF NOT EXISTS idx_cv_visits_ip ON cv_visits(ip_address);
    CREATE INDEX IF NOT EXISTS idx_cv_visits_visited_at ON cv_visits(visited_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cv_visits_device ON cv_visits(device_type);
    CREATE INDEX IF NOT EXISTS idx_cv_visits_browser ON cv_visits(browser);

    -- Vista para analytics rápidos
    CREATE OR REPLACE VIEW cv_analytics_summary AS
    SELECT
        COUNT(*) as total_visits,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '1 day') as visits_last_24h,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '7 days') as visits_last_7d,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '30 days') as visits_last_30d,
        COUNT(*) FILTER (WHERE visited_at::date = CURRENT_DATE) as visits_today
    FROM cv_visits;
    """

    async with DB_POOL.acquire() as conn:
        try:
            await conn.execute(DDL_SCRIPT)
            print("✅ Database schema initialized")
        except Exception as e:
            print(f"⚠️  Database initialization error: {e}")
            # No fallar el startup si ya existe


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestión del ciclo de vida de la aplicación"""
    global DB_POOL

    # Startup: Crear pool de conexiones
    DB_POOL = await asyncpg.create_pool(
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "postgres"),
        host=os.getenv("DB_HOST", "postgres17"),
        port=int(os.getenv("DB_PORT", "5432")),
        min_size=1,
        max_size=10
    )
    print("✅ Database pool created")

    # Inicializar base de datos (crear tabla si no existe)
    await init_database()

    yield

    # Shutdown: Cerrar pool
    await DB_POOL.close()
    print("🔴 Database pool closed")


app = FastAPI(
    title="CV Analytics API",
    description="Sistema de tracking para el CV de José Hernán Varela",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurado para tu dominio
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://devapis.cloud",
        "http://localhost:8000",
        "http://localhost"
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True
)


def parse_user_agent(ua_string: str) -> dict:
    """Parse básico de user agent (sin librería externa)"""
    ua_lower = ua_string.lower()

    # Detectar navegador
    if "edg" in ua_lower:
        browser = "Edge"
    elif "chrome" in ua_lower and "edg" not in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    elif "opera" in ua_lower or "opr" in ua_lower:
        browser = "Opera"
    else:
        browser = "Unknown"

    # Detectar OS
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "mac" in ua_lower or "darwin" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_name = "iOS"
    else:
        os_name = "Unknown"

    # Detectar tipo de dispositivo
    mobile_keywords = ["mobile", "android", "iphone", "ipad", "phone", "tablet"]
    device_type = "Mobile" if any(kw in ua_lower for kw in mobile_keywords) else "Desktop"

    return {
        "browser": browser,
        "os": os_name,
        "device_type": device_type
    }


@app.post("/api/track")
async def track_visit(request: Request):
    """
    Endpoint para registrar una visita al CV

    Headers usados:
    - x-forwarded-for: IP real del visitante (desde Traefik)
    - user-agent: Información del navegador
    - referer: De dónde viene
    - accept-language: Idioma
    """

    try:
        # Obtener IP real (Traefik la pasa en x-forwarded-for)
        ip = request.headers.get("x-forwarded-for", request.client.host)
        if ip and "," in ip:
            # Si hay múltiples IPs, tomar la primera (la real)
            ip = ip.split(",")[0].strip()

        # Obtener user agent
        user_agent_string = request.headers.get("user-agent", "Unknown")
        ua_info = parse_user_agent(user_agent_string)

        # Datos adicionales
        referer = request.headers.get("referer")
        language = request.headers.get("accept-language", "Unknown")
        if language and "," in language:
            # Tomar solo el idioma principal
            language = language.split(",")[0].strip()

        # Insertar en base de datos
        async with DB_POOL.acquire() as conn:
            await conn.execute("""
                INSERT INTO cv_visits (
                    ip_address,
                    user_agent,
                    browser,
                    os,
                    device_type,
                    referer,
                    language,
                    visited_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
                ip,
                user_agent_string,
                ua_info["browser"],
                ua_info["os"],
                ua_info["device_type"],
                referer,
                language,
                datetime.utcnow()
            )

        return {
            "status": "tracked",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        print(f"❌ Error tracking visit: {e}")
        # No fallar aunque haya error en analytics
        return {"status": "error", "message": str(e)}


def to_venezuela_time(dt):
    """Convierte datetime UTC a hora de Venezuela (UTC-4)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Asumir que es UTC si no tiene timezone
        dt = dt.replace(tzinfo=timezone.utc)
    venezuela_tz = timezone(timedelta(hours=-4))
    return dt.astimezone(venezuela_tz)


@app.get("/api/analytics")
async def get_analytics():
    """
    Endpoint para obtener estadísticas de visitas

    Returns:
        JSON con estadísticas generales
    """

    async with DB_POOL.acquire() as conn:
        # Total de visitas
        total_visits = await conn.fetchval("SELECT COUNT(*) FROM cv_visits")

        # Visitas únicas por IP
        unique_visitors = await conn.fetchval(
            "SELECT COUNT(DISTINCT ip_address) FROM cv_visits"
        )

        # Visitas últimos 7 días
        recent_visits = await conn.fetchval("""
            SELECT COUNT(*) FROM cv_visits
            WHERE visited_at > NOW() - INTERVAL '7 days'
        """)

        # Visitas hoy
        today_visits = await conn.fetchval("""
            SELECT COUNT(*) FROM cv_visits
            WHERE visited_at::date = CURRENT_DATE
        """)

        # Top 5 navegadores
        top_browsers = await conn.fetch("""
            SELECT browser, COUNT(*) as count
            FROM cv_visits
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 5
        """)

        # Top 10 IPs
        top_ips = await conn.fetch("""
            SELECT
                ip_address,
                COUNT(*) as visits,
                MAX(visited_at) as last_visit
            FROM cv_visits
            GROUP BY ip_address
            ORDER BY visits DESC
            LIMIT 10
        """)

        # Dispositivos
        device_stats = await conn.fetch("""
            SELECT device_type, COUNT(*) as count
            FROM cv_visits
            GROUP BY device_type
        """)

        # Sistemas operativos
        os_stats = await conn.fetch("""
            SELECT os, COUNT(*) as count
            FROM cv_visits
            GROUP BY os
            ORDER BY count DESC
            LIMIT 5
        """)

        # Visitas por día (últimos 30 días)
        daily_visits = await conn.fetch("""
            SELECT
                DATE(visited_at) as date,
                COUNT(*) as visits
            FROM cv_visits
            WHERE visited_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(visited_at)
            ORDER BY date DESC
        """)

    return {
        "summary": {
            "total_visits": total_visits,
            "unique_visitors": unique_visitors,
            "recent_visits_7d": recent_visits,
            "today_visits": today_visits
        },
        "top_browsers": [dict(r) for r in top_browsers],
        "top_ips": [
            {
                **dict(r),
                "last_visit": to_venezuela_time(r["last_visit"]).isoformat() if r["last_visit"] else None
            }
            for r in top_ips
        ],
        "device_stats": [dict(r) for r in device_stats],
        "os_stats": [dict(r) for r in os_stats],
        "daily_visits": [
            {
                "date": r["date"].isoformat(),
                "visits": r["visits"]
            }
            for r in daily_visits
        ]
    }


@app.get("/api/analytics/recent")
async def get_recent_visits(limit: int = 20):
    """
    Obtener visitas recientes

    Args:
        limit: Número de visitas a retornar (default: 20, max: 100)
    """

    if limit > 100:
        limit = 100

    async with DB_POOL.acquire() as conn:
        visits = await conn.fetch("""
            SELECT
                ip_address,
                browser,
                os,
                device_type,
                referer,
                language,
                visited_at
            FROM cv_visits
            ORDER BY visited_at DESC
            LIMIT $1
        """, limit)

    return {
        "visits": [
            {
                **dict(v),
                "visited_at": to_venezuela_time(v["visited_at"]).isoformat()
            }
            for v in visits
        ]
    }


@app.get("/analytics", response_class=HTMLResponse)
async def analytics_dashboard():
    """Dashboard HTML simple para ver analytics"""

    html = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CV Analytics Dashboard</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #0f172a;
                color: #f1f5f9;
                padding: 2rem;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { margin-bottom: 2rem; color: #0ea5e9; }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: #1e293b;
                padding: 1.5rem;
                border-radius: 0.5rem;
                border: 1px solid #334155;
            }
            .stat-value {
                font-size: 2rem;
                font-weight: 700;
                color: #0ea5e9;
                margin-bottom: 0.5rem;
            }
            .stat-label {
                color: #94a3b8;
                font-size: 0.875rem;
            }
            .section {
                background: #1e293b;
                padding: 1.5rem;
                border-radius: 0.5rem;
                margin-bottom: 1.5rem;
                border: 1px solid #334155;
            }
            .section h2 {
                margin-bottom: 1rem;
                color: #e2e8f0;
                font-size: 1.25rem;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                padding: 0.75rem;
                text-align: left;
                border-bottom: 1px solid #334155;
            }
            th { color: #94a3b8; font-weight: 600; }
            .refresh-btn {
                background: #0ea5e9;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 1rem;
                margin-bottom: 1rem;
            }
            .refresh-btn:hover { background: #0284c7; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📊 CV Analytics Dashboard</h1>

            <button class="refresh-btn" onclick="loadData()">🔄 Actualizar</button>

            <div class="stats-grid" id="stats-grid"></div>

            <div class="section">
                <h2>Top Navegadores</h2>
                <table id="browsers-table"></table>
            </div>

            <div class="section">
                <h2>Top Visitantes (IPs)</h2>
                <table id="ips-table"></table>
            </div>

            <div class="section">
                <h2>Dispositivos</h2>
                <table id="devices-table"></table>
            </div>

            <div class="section">
                <h2>Visitas Recientes</h2>
                <table id="recent-table"></table>
            </div>
        </div>

        <script>
            async function loadData() {
                try {
                    const [analytics, recent] = await Promise.all([
                        fetch('/api/analytics').then(r => r.json()),
                        fetch('/api/analytics/recent?limit=10').then(r => r.json())
                    ]);

                    // Stats cards
                    document.getElementById('stats-grid').innerHTML = `
                        <div class="stat-card">
                            <div class="stat-value">${analytics.summary.total_visits}</div>
                            <div class="stat-label">Visitas Totales</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${analytics.summary.unique_visitors}</div>
                            <div class="stat-label">Visitantes Únicos</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${analytics.summary.recent_visits_7d}</div>
                            <div class="stat-label">Últimos 7 Días</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${analytics.summary.today_visits}</div>
                            <div class="stat-label">Hoy</div>
                        </div>
                    `;

                    // Browsers table
                    document.getElementById('browsers-table').innerHTML = `
                        <tr><th>Navegador</th><th>Visitas</th></tr>
                        ${analytics.top_browsers.map(b => `
                            <tr><td>${b.browser}</td><td>${b.count}</td></tr>
                        `).join('')}
                    `;

                    // IPs table
                    document.getElementById('ips-table').innerHTML = `
                        <tr><th>IP</th><th>Visitas</th><th>Última Visita</th></tr>
                        ${analytics.top_ips.map(ip => `
                            <tr>
                                <td>${ip.ip_address}</td>
                                <td>${ip.visits}</td>
                                <td>${new Date(ip.last_visit).toLocaleString('es')}</td>
                            </tr>
                        `).join('')}
                    `;

                    // Devices table
                    document.getElementById('devices-table').innerHTML = `
                        <tr><th>Dispositivo</th><th>Visitas</th></tr>
                        ${analytics.device_stats.map(d => `
                            <tr><td>${d.device_type}</td><td>${d.count}</td></tr>
                        `).join('')}
                    `;

                    // Recent visits table
                    document.getElementById('recent-table').innerHTML = `
                        <tr><th>IP</th><th>Navegador</th><th>OS</th><th>Dispositivo</th><th>Fecha</th></tr>
                        ${recent.visits.map(v => `
                            <tr>
                                <td>${v.ip_address}</td>
                                <td>${v.browser}</td>
                                <td>${v.os}</td>
                                <td>${v.device_type}</td>
                                <td>${new Date(v.visited_at).toLocaleString('es')}</td>
                            </tr>
                        `).join('')}
                    `;
                } catch (error) {
                    console.error('Error loading data:', error);
                }
            }

            // Cargar datos al inicio
            loadData();

            // Auto-refresh cada 30 segundos
            setInterval(loadData, 30000);
        </script>
    </body>
    </html>
    """

    return HTMLResponse(content=html)


@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        async with DB_POOL.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "CV Analytics API",
        "version": "1.0.0",
        "endpoints": {
            "track": "POST /api/track",
            "analytics": "GET /api/analytics",
            "recent": "GET /api/analytics/recent",
            "dashboard": "GET /dashboard",
            "health": "GET /health"
        }
    }
