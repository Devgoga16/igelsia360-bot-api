# 🐳 Guía de Docker - WhatsApp Bot

Esta guía te ayudará a desplegar el bot de WhatsApp usando Docker y Docker Compose.

## 📋 Requisitos Previos

- Docker instalado: [Download Docker](https://www.docker.com/products/docker-desktop)
- Docker Compose (incluido en Docker Desktop)

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Copiar el ejemplo
copy .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
PORT=3000

# Gmail para notificaciones
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
EMAIL_FROM=tu_correo@gmail.com
EMAIL_TO=destinatario@gmail.com

NODE_ENV=production
SESSION_NAME=iglesia360-session
API_URL=http://localhost:3000
```

### 2. Construir y Ejecutar

```bash
# Construir la imagen y levantar el contenedor
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f
```

### 3. Escanear el Código QR

Una vez que el contenedor esté corriendo:

```bash
# Abrir en el navegador
http://localhost:3000/api/qr-image
```

Escanea el código QR con tu WhatsApp y ¡listo!

## 📦 Comandos Docker Compose

### Gestión del Contenedor

```bash
# Iniciar el bot
docker-compose up -d

# Detener el bot
docker-compose down

# Reiniciar el bot
docker-compose restart

# Ver logs
docker-compose logs -f

# Ver logs de las últimas 100 líneas
docker-compose logs --tail=100

# Ver estado
docker-compose ps

# Ver uso de recursos
docker stats iglesia360-bot
```

### Actualizar la Aplicación

```bash
# Detener el contenedor
docker-compose down

# Reconstruir la imagen
docker-compose build --no-cache

# Iniciar de nuevo
docker-compose up -d
```

### Limpiar Sesión

Si necesitas limpiar la sesión de WhatsApp:

```bash
# Opción 1: Usar el API
curl -X POST http://localhost:3000/api/clean-session

# Opción 2: Eliminar volúmenes
docker-compose down -v
docker-compose up -d
```

## 🔧 Comandos Docker Directo

Si prefieres usar Docker sin Compose:

### Construir la Imagen

```bash
docker build -t iglesia360-bot:latest .
```

### Ejecutar el Contenedor

```bash
docker run -d \
  --name iglesia360-bot \
  -p 3000:3000 \
  -e EMAIL_USER=tu_correo@gmail.com \
  -e EMAIL_PASS=tu_contraseña \
  -e EMAIL_FROM=tu_correo@gmail.com \
  -e EMAIL_TO=destinatario@gmail.com \
  -v whatsapp-session:/app/.wwebjs_auth \
  -v whatsapp-cache:/app/.wwebjs_cache \
  -v bot-logs:/app/logs \
  --restart unless-stopped \
  iglesia360-bot:latest
```

### Gestión

```bash
# Ver logs
docker logs -f iglesia360-bot

# Detener
docker stop iglesia360-bot

# Iniciar
docker start iglesia360-bot

# Reiniciar
docker restart iglesia360-bot

# Eliminar contenedor
docker rm -f iglesia360-bot

# Eliminar volúmenes
docker volume rm whatsapp-session whatsapp-cache bot-logs
```

## 📊 Monitoreo

### Ver Estado del Bot

```bash
# Health check
curl http://localhost:3000/health

# Estado detallado
curl http://localhost:3000/api/status
```

### Ver Logs del Contenedor

```bash
# Logs en tiempo real
docker-compose logs -f

# Últimas 50 líneas
docker-compose logs --tail=50

# Logs de un servicio específico
docker-compose logs -f whatsapp-bot
```

### Acceder al Contenedor

```bash
# Abrir shell en el contenedor
docker-compose exec whatsapp-bot sh

# Ver archivos de sesión
docker-compose exec whatsapp-bot ls -la .wwebjs_auth

# Ver logs internos
docker-compose exec whatsapp-bot cat logs/combined.log
```

## 🔐 Seguridad

### Mejores Prácticas

1. **No incluir .env en el repositorio**
   - Ya está en `.gitignore`
   - Usa variables de entorno seguras

2. **Limitar recursos del contenedor**
   - Ya configurado en `docker-compose.yml`
   - 1GB RAM máximo

3. **Usuario no-root**
   - El contenedor corre con usuario `botuser`
   - No tiene privilegios de root

4. **Health checks**
   - Monitoreo automático cada 30s
   - Reinicio automático si falla

## 📁 Volúmenes Persistentes

El bot usa 3 volúmenes para persistencia:

```bash
# Ver volúmenes
docker volume ls | grep iglesia360

# Backup de la sesión
docker run --rm \
  -v whatsapp-session:/source \
  -v $(pwd):/backup \
  alpine tar czf /backup/session-backup.tar.gz -C /source .

# Restaurar backup
docker run --rm \
  -v whatsapp-session:/target \
  -v $(pwd):/backup \
  alpine tar xzf /backup/session-backup.tar.gz -C /target
```

## 🌐 Despliegue en Producción

### En un VPS (Ubuntu/Debian)

```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Clonar el repositorio
git clone <tu-repo>
cd iglesia360-bot-api

# 3. Configurar .env
nano .env

# 4. Levantar el bot
docker-compose up -d

# 5. Ver logs
docker-compose logs -f
```

### Con Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Con SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Auto-renovación
sudo certbot renew --dry-run
```

## 🐛 Solución de Problemas

### El contenedor no inicia

```bash
# Ver logs completos
docker-compose logs

# Verificar configuración
docker-compose config

# Reconstruir sin cache
docker-compose build --no-cache
docker-compose up -d
```

### El QR no se genera

```bash
# Ver logs específicos
docker-compose logs -f | grep -i "qr\|error"

# Verificar que Chrome se instaló correctamente
docker-compose exec whatsapp-bot google-chrome --version

# Reiniciar el contenedor
docker-compose restart
```

### Problemas de permisos

```bash
# Ver permisos
docker-compose exec whatsapp-bot ls -la

# Corregir permisos (si es necesario)
docker-compose exec --user root whatsapp-bot chown -R botuser:botuser /app
```

### Limpiar todo y empezar de cero

```bash
# Detener y eliminar todo
docker-compose down -v

# Eliminar imágenes
docker rmi iglesia360-bot-api_whatsapp-bot

# Limpiar Docker
docker system prune -a

# Reconstruir
docker-compose up -d --build
```

## 📈 Optimización

### Reducir tamaño de la imagen

La imagen ya está optimizada:
- Base: `node:18-bullseye-slim` (~200MB)
- Total con dependencias: ~800MB-1GB

### Mejorar rendimiento

```yaml
# En docker-compose.yml, ajustar recursos:
deploy:
  resources:
    limits:
      memory: 2G  # Aumentar si es necesario
      cpus: '2.0'
```

## 🔄 Updates Automáticos

### Con Watchtower

```bash
# Instalar Watchtower
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  iglesia360-bot
```

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `docker-compose logs -f`
2. Verifica el estado: `curl http://localhost:3000/api/status`
3. Consulta [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. Revisa [AUTO-RECOVERY.md](AUTO-RECOVERY.md)

## 🎉 ¡Listo!

Tu bot de WhatsApp está corriendo en Docker con:
- ✅ Persistencia de sesión
- ✅ Auto-recuperación
- ✅ Health checks
- ✅ Logs estructurados
- ✅ Seguridad mejorada
- ✅ Reinicio automático

**Accede a:** http://localhost:3000
