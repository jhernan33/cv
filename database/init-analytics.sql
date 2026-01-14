-- ============================================
-- CV ANALYTICS DATABASE SCHEMA
-- ============================================
-- Script para crear tabla de tracking de visitas
-- Compatible con PostgreSQL 13+

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

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar performance de queries
CREATE INDEX IF NOT EXISTS idx_cv_visits_ip ON cv_visits(ip_address);
CREATE INDEX IF NOT EXISTS idx_cv_visits_visited_at ON cv_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_visits_device ON cv_visits(device_type);
CREATE INDEX IF NOT EXISTS idx_cv_visits_browser ON cv_visits(browser);

-- Vista materializada para analytics rápidos (opcional)
CREATE OR REPLACE VIEW cv_analytics_summary AS
SELECT
    COUNT(*) as total_visits,
    COUNT(DISTINCT ip_address) as unique_visitors,
    COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '1 day') as visits_last_24h,
    COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '7 days') as visits_last_7d,
    COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '30 days') as visits_last_30d,
    COUNT(*) FILTER (WHERE visited_at::date = CURRENT_DATE) as visits_today
FROM cv_visits;

-- Comentarios para documentación
COMMENT ON TABLE cv_visits IS 'Registro de visitas al CV de José Hernán Varela';
COMMENT ON COLUMN cv_visits.ip_address IS 'Dirección IP del visitante (desde x-forwarded-for de Traefik)';
COMMENT ON COLUMN cv_visits.user_agent IS 'User-Agent completo del navegador';
COMMENT ON COLUMN cv_visits.browser IS 'Navegador detectado (Chrome, Firefox, etc)';
COMMENT ON COLUMN cv_visits.os IS 'Sistema operativo detectado (Windows, Linux, etc)';
COMMENT ON COLUMN cv_visits.device_type IS 'Tipo de dispositivo (Mobile/Desktop)';
COMMENT ON COLUMN cv_visits.referer IS 'URL de origen de la visita';
COMMENT ON COLUMN cv_visits.language IS 'Idioma preferido del navegador';
COMMENT ON COLUMN cv_visits.visited_at IS 'Timestamp UTC de la visita';

-- Query de ejemplo para ver visitas recientes
-- SELECT * FROM cv_visits ORDER BY visited_at DESC LIMIT 10;

-- Query de ejemplo para ver resumen
-- SELECT * FROM cv_analytics_summary;

-- Query de ejemplo para top IPs
-- SELECT ip_address, COUNT(*) as visits FROM cv_visits GROUP BY ip_address ORDER BY visits DESC LIMIT 10;
