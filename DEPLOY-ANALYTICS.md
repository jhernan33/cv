# 🚀 Despliegue del Sistema de Analytics

Este documento te guía paso a paso para desplegar el sistema de analytics en tu servidor.

## 📋 Pre-requisitos

- ✅ Contenedor PostgreSQL corriendo (`postgres17`)
- ✅ Traefik configurado en red `server`
- ✅ Docker y Docker Compose instalados
- ✅ Acceso a la base de datos PostgreSQL

## 🔧 Paso 1: Configurar Variables de Entorno

```bash
# Crear archivo .env en la raíz del proyecto
nano .env
```

Agregar el siguiente contenido (ajustar según tu configuración):

```env
DB_HOST=postgres17
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=tu_password_real_aqui
DB_PORT=5432
```

**IMPORTANTE**: Reemplaza `tu_password_real_aqui` con la contraseña real de tu PostgreSQL.

## 📊 Paso 2: Crear la Tabla en PostgreSQL

Conecta a tu base de datos PostgreSQL y ejecuta el script SQL:

```bash
# Opción 1: Desde el host
cat database/init-analytics.sql | docker exec -i postgres17 psql -U postgres -d postgres

# Opción 2: Manualmente
docker exec -it postgres17 psql -U postgres -d postgres
```

Si usas la opción 2, copia y pega el contenido de `database/init-analytics.sql`

### Verificar que la tabla se creó correctamente:

```bash
docker exec -it postgres17 psql -U postgres -d postgres -c "\dt cv_visits"
```

Deberías ver:

```
          List of relations
 Schema |   Name    | Type  |  Owner
--------+-----------+-------+----------
 public | cv_visits | table | postgres
```

## 🐳 Paso 3: Construir y Levantar el Backend

```bash
# Construir la imagen del backend
docker compose build analytics-api

# Levantar ambos servicios (CV + Analytics)
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f analytics-api
```

## ✅ Paso 4: Verificar que Todo Funciona

### 4.1. Verificar que los contenedores están corriendo:

```bash
docker compose ps
```

Deberías ver:

```
NAME           STATUS
landpage       Up (healthy)
cv-analytics   Up (healthy)
```

### 4.2. Probar el health check del backend:

```bash
curl https://devapis.cloud/health
```

Respuesta esperada:

```json
{"status":"healthy","database":"connected"}
```

### 4.3. Probar el tracking:

```bash
curl -X POST https://devapis.cloud/api/track \
  -H "Content-Type: application/json"
```

Respuesta esperada:

```json
{"status":"tracked","timestamp":"2026-01-13T..."}
```

### 4.4. Ver analytics:

```bash
curl https://devapis.cloud/api/analytics
```

### 4.5. Acceder al Dashboard:

Abre en tu navegador:

```
https://devapis.cloud/dashboard
```

## 🔍 Paso 5: Verificar en el Frontend

1. Abre tu CV: `https://devapis.cloud/cv`
2. Abre la consola del navegador (F12)
3. Deberías ver: `✅ Visit tracked: 2026-01-13T...`
4. Refresca el dashboard: `https://devapis.cloud/dashboard`
5. Deberías ver tu visita registrada

## 📊 Queries Útiles

### Ver todas las visitas:

```sql
docker exec -it postgres17 psql -U postgres -d postgres -c "SELECT * FROM cv_visits ORDER BY visited_at DESC LIMIT 10;"
```

### Ver resumen de analytics:

```sql
docker exec -it postgres17 psql -U postgres -d postgres -c "SELECT * FROM cv_analytics_summary;"
```

### Ver top 10 IPs:

```sql
docker exec -it postgres17 psql -U postgres -d postgres -c "
  SELECT ip_address, COUNT(*) as visits, MAX(visited_at) as last_visit
  FROM cv_visits
  GROUP BY ip_address
  ORDER BY visits DESC
  LIMIT 10;
"
```

### Ver estadísticas de navegadores:

```sql
docker exec -it postgres17 psql -U postgres -d postgres -c "
  SELECT browser, COUNT(*) as count
  FROM cv_visits
  GROUP BY browser
  ORDER BY count DESC;
"
```

## 🔧 Troubleshooting

### Problema: Analytics no está conectando a PostgreSQL

**Síntoma**: Error "Database error" en `/health`

**Solución**:

1. Verificar que postgres17 está corriendo:
   ```bash
   docker ps | grep postgres17
   ```

2. Verificar variables de entorno:
   ```bash
   docker exec cv-analytics env | grep DB_
   ```

3. Probar conexión manual:
   ```bash
   docker exec cv-analytics python -c "
   import asyncpg, asyncio
   async def test():
       conn = await asyncpg.connect(
           user='postgres',
           password='tu_password',
           database='postgres',
           host='postgres17'
       )
       print('✅ Connected!')
       await conn.close()
   asyncio.run(test())
   "
   ```

### Problema: Tracker no funciona en el frontend

**Síntoma**: No hay mensaje en consola del navegador

**Solución**:

1. Verificar que el archivo `main.js` tiene el módulo Analytics
2. Limpiar caché del navegador (Ctrl+Shift+R)
3. Verificar CORS en las herramientas de desarrollador
4. Verificar que el endpoint responde:
   ```bash
   curl -X POST https://devapis.cloud/api/track
   ```

### Problema: Dashboard no carga

**Síntoma**: Error 404 o página en blanco

**Solución**:

1. Verificar que el servicio analytics-api está corriendo
2. Verificar logs:
   ```bash
   docker compose logs analytics-api
   ```

3. Verificar routing de Traefik:
   ```bash
   docker logs traefik | grep analytics
   ```

## 📈 Monitoreo Continuo

### Ver logs en tiempo real:

```bash
# Logs del backend
docker compose logs -f analytics-api

# Últimas 50 líneas
docker compose logs --tail 50 analytics-api
```

### Reiniciar servicios:

```bash
# Solo analytics
docker compose restart analytics-api

# Todo el stack
docker compose restart
```

### Ver estadísticas de visitas en tiempo real:

```bash
# Comando que se actualiza cada 5 segundos
watch -n 5 'docker exec -i postgres17 psql -U postgres -d postgres -t -c "SELECT * FROM cv_analytics_summary;"'
```

## 🎯 Próximos Pasos

Una vez que todo esté funcionando, puedes:

1. ✅ Agregar geolocalización de IPs con MaxMind GeoIP2
2. ✅ Crear gráficos con Chart.js en el dashboard
3. ✅ Configurar alertas por email cuando alguien visite
4. ✅ Agregar heatmap de clicks con Hotjar o similar
5. ✅ Implementar política de privacidad (GDPR)
6. ✅ Agregar autenticación al dashboard (opcional)

## 🔐 Seguridad

**Importante**: El dashboard está **públicamente accesible**. Considera:

1. Agregar autenticación HTTP básica:
   ```yaml
   # En docker-compose.yaml, agregar middleware
   - "traefik.http.middlewares.dashboard-auth.basicauth.users=user:$$apr1$$..."
   - "traefik.http.routers.analytics.middlewares=dashboard-auth"
   ```

2. O restringir por IP:
   ```yaml
   - "traefik.http.middlewares.dashboard-ip.ipwhitelist.sourcerange=tu.ip.aqui/32"
   ```

3. O mover el dashboard a otro path privado:
   ```python
   # En backend/main.py cambiar:
   @app.get("/dashboard")  # a
   @app.get("/private/dashboard")
   ```

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `docker compose logs analytics-api`
2. Verifica la conectividad de red: `docker network inspect server`
3. Prueba las queries SQL directamente en PostgreSQL

---

**¡Listo!** Ahora tienes un sistema completo de analytics funcionando 🎉
