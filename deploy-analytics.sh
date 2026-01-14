#!/bin/bash

# ============================================
# Script de Despliegue - CV Analytics
# ============================================
# Automatiza el despliegue del sistema de analytics
# Uso: ./deploy-analytics.sh

set -e  # Exit on error

echo "🚀 Iniciando despliegue de CV Analytics..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# 1. Verificar pre-requisitos
# ============================================

echo "📋 Verificando pre-requisitos..."

# Verificar que existe docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

# Verificar que existe docker compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    exit 1
fi

# Verificar que el contenedor postgres17 existe
if ! docker ps -a | grep -q postgres17; then
    echo -e "${RED}❌ Contenedor postgres17 no encontrado${NC}"
    echo "   Asegúrate de que PostgreSQL está corriendo"
    exit 1
fi

# Verificar que la red server existe
if ! docker network ls | grep -q server; then
    echo -e "${YELLOW}⚠️  Red 'server' no encontrada. Creándola...${NC}"
    docker network create server
fi

echo -e "${GREEN}✅ Pre-requisitos verificados${NC}"
echo ""

# ============================================
# 2. Verificar archivo .env
# ============================================

echo "🔧 Verificando configuración..."

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado${NC}"
    echo "   Creando .env desde .env.example..."

    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales reales${NC}"
        echo "   Ejecuta: nano .env"
        echo ""
        read -p "Presiona Enter cuando hayas configurado el archivo .env..."
    else
        echo -e "${RED}❌ Archivo .env.example no encontrado${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Configuración verificada${NC}"
echo ""

# ============================================
# 3. Crear tabla en PostgreSQL
# ============================================

echo "📊 Creando tabla en PostgreSQL..."

# Verificar si la tabla ya existe
TABLE_EXISTS=$(docker exec postgres17 psql -U postgres -d postgres -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='cv_visits')")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${YELLOW}⚠️  La tabla cv_visits ya existe${NC}"
    read -p "¿Quieres recrearla? (elimina todos los datos) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Eliminando tabla existente..."
        docker exec -i postgres17 psql -U postgres -d postgres -c "DROP TABLE IF EXISTS cv_visits CASCADE;"
    else
        echo "   Manteniendo tabla existente"
    fi
fi

# Ejecutar script SQL
echo "   Ejecutando script SQL..."
cat database/init-analytics.sql | docker exec -i postgres17 psql -U postgres -d postgres

# Verificar que se creó correctamente
TABLE_EXISTS=$(docker exec postgres17 psql -U postgres -d postgres -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='cv_visits')")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Tabla creada correctamente${NC}"
else
    echo -e "${RED}❌ Error al crear la tabla${NC}"
    exit 1
fi

echo ""

# ============================================
# 4. Build y deploy
# ============================================

echo "🐳 Construyendo y desplegando servicios..."

# Build de la imagen
echo "   Building backend..."
docker compose build analytics-api

# Levantar servicios
echo "   Levantando servicios..."
docker compose up -d

echo -e "${GREEN}✅ Servicios levantados${NC}"
echo ""

# ============================================
# 5. Verificar health checks
# ============================================

echo "🏥 Verificando health checks..."
echo "   Esperando 10 segundos para que los servicios inicien..."
sleep 10

# Verificar estado de contenedores
echo ""
echo "Estado de contenedores:"
docker compose ps

echo ""

# Esperar a que el health check pase
MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' cv-analytics 2>/dev/null || echo "unhealthy")

    if [ "$HEALTH_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ Backend healthy${NC}"
        break
    fi

    echo -n "."
    sleep 2
    RETRY=$((RETRY + 1))
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Backend no pasó el health check después de 60s${NC}"
    echo "   Ver logs: docker compose logs analytics-api"
    exit 1
fi

echo ""

# ============================================
# 6. Probar endpoints
# ============================================

echo "🧪 Probando endpoints..."

# Test 1: Health check
echo -n "   Probando /health... "
HEALTH_RESPONSE=$(curl -s https://devapis.cloud/health | grep -o "healthy" || echo "failed")

if [ "$HEALTH_RESPONSE" = "healthy" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "      Respuesta: $HEALTH_RESPONSE"
fi

# Test 2: Track endpoint
echo -n "   Probando /api/track... "
TRACK_RESPONSE=$(curl -s -X POST https://devapis.cloud/api/track | grep -o "tracked" || echo "failed")

if [ "$TRACK_RESPONSE" = "tracked" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "      Respuesta: $TRACK_RESPONSE"
fi

# Test 3: Analytics endpoint
echo -n "   Probando /api/analytics... "
ANALYTICS_RESPONSE=$(curl -s https://devapis.cloud/api/analytics | grep -o "total_visits" || echo "failed")

if [ "$ANALYTICS_RESPONSE" = "total_visits" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo ""

# ============================================
# 7. Mostrar información útil
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 URLs disponibles:"
echo "   • CV: https://devapis.cloud/cv"
echo "   • Dashboard: https://devapis.cloud/dashboard"
echo "   • API: https://devapis.cloud/api/analytics"
echo "   • Health: https://devapis.cloud/health"
echo ""
echo "🔍 Comandos útiles:"
echo "   • Ver logs: docker compose logs -f analytics-api"
echo "   • Reiniciar: docker compose restart analytics-api"
echo "   • Ver stats: docker compose exec postgres17 psql -U postgres -d postgres -c 'SELECT * FROM cv_analytics_summary;'"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Visita tu CV: https://devapis.cloud/cv"
echo "   2. Abre el dashboard: https://devapis.cloud/dashboard"
echo "   3. ¡Comparte tu CV y ve las estadísticas!"
echo ""

# Mostrar visitas actuales
TOTAL_VISITS=$(docker exec -i postgres17 psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM cv_visits" 2>/dev/null || echo "0")
echo -e "${GREEN}📊 Visitas registradas hasta ahora: $TOTAL_VISITS${NC}"
echo ""
