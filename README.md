# 📱 Bot de WhatsApp - Iglesia360 API

API robusta para enviar mensajes de WhatsApp usando WhatsApp Web, con persistencia de sesión, notificaciones por correo y reconexión automática.

## 🚀 Características

- ✅ **Envío de mensajes** a través de WhatsApp Web
- 📊 **Monitoreo en tiempo real** del estado del bot
- 🔄 **Reconexión automática** en caso de desconexión
- 📧 **Notificaciones por correo** cuando el bot se desconecta o conecta
- 🔐 **Persistencia de sesión** - No necesitas escanear el QR cada vez
- 📱 **Visualización del QR** en el navegador
- 🛡️ **Rate limiting** para proteger la API
- 📝 **Sistema de logging** completo
- 🔒 **Seguridad** con Helmet y CORS

## 📋 Requisitos Previos

- Node.js 16 o superior
- npm o yarn
- Una cuenta de Gmail (para notificaciones por correo)

## 🔧 Instalación

### 1. Clonar el repositorio (o usar el proyecto existente)

```bash
cd iglesia360-bot-api
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env`:

```bash
copy .env.example .env
```

Edita el archivo `.env` con tus configuraciones:

```env
# Puerto del servidor
PORT=3000

# Configuración de correo para notificaciones
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
EMAIL_FROM=tu_correo@gmail.com
EMAIL_TO=destinatario@gmail.com

# Configuración de la aplicación
NODE_ENV=production
SESSION_NAME=iglesia360-session

# URL base de la API (para generar links de QR)
API_URL=http://localhost:3000
```

### 4. Configurar Gmail para envío de correos

Para usar Gmail, necesitas generar una **contraseña de aplicación**:

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Navega a **Seguridad**
3. Activa la **verificación en dos pasos** (si no la tienes)
4. Busca **Contraseñas de aplicaciones**
5. Genera una nueva contraseña para "Correo"
6. Usa esta contraseña en `EMAIL_PASS` en tu archivo `.env`

## 🎯 Uso

### Iniciar el servidor

```bash
npm start
```

Para desarrollo con auto-reload:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### Primera vez - Escanear QR

1. Inicia el servidor
2. Abre en tu navegador: `http://localhost:3000/api/qr-image`
3. Escanea el código QR con WhatsApp en tu teléfono:
   - Abre WhatsApp
   - Ve a **Configuración** → **Dispositivos vinculados**
   - Toca **Vincular un dispositivo**
   - Escanea el código QR

Una vez escaneado, la sesión se guardará y no necesitarás escanear el QR nuevamente.

## 📡 Endpoints de la API

### 1. Enviar Mensaje

**POST** `/api/send-message`

Envía un mensaje de WhatsApp a un número específico.

**Body:**
```json
{
  "phoneNumber": "987654321",
  "message": "Hola, este es un mensaje de prueba"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "messageId": "...",
    "timestamp": 1234567890,
    "to": "987654321"
  },
  "message": "Mensaje enviado exitosamente"
}
```

**Ejemplos con cURL:**

```bash
# Con número de 9 dígitos (Perú)
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"987654321\",\"message\":\"Hola desde la API\"}"

# Con código de país completo
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"51987654321\",\"message\":\"Hola desde la API\"}"
```

### 2. Estado del Bot

**GET** `/api/status`

Obtiene el estado actual del bot en tiempo real.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "isReady": true,
    "isAuthenticating": false,
    "hasQR": false,
    "lastDisconnect": null,
    "uptime": 3600,
    "clientInfo": {
      "name": "Iglesia360",
      "number": "51987654321",
      "platform": "android"
    }
  },
  "timestamp": "2026-01-09T12:00:00.000Z"
}
```

**Estados posibles:**
- `disconnected` - Bot desconectado
- `qr_ready` - Código QR listo para escanear
- `authenticated` - Autenticado, conectando...
- `connected` - Conectado y listo para enviar mensajes
- `loading` - Cargando...
- `auth_failure` - Error de autenticación

**Ejemplo:**
```bash
curl http://localhost:3000/api/status
```

### 3. Obtener Código QR (JSON)

**GET** `/api/qr`

Obtiene el código QR en formato base64 (para integraciones).

**Respuesta con QR:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "message": "Escanea el código QR con WhatsApp",
  "status": "qr_ready"
}
```

**Respuesta si ya está conectado:**
```json
{
  "success": true,
  "message": "El bot ya está conectado",
  "status": "connected",
  "connected": true
}
```

### 4. Ver Código QR (Navegador)

**GET** `/api/qr-image`

Muestra el código QR en una página web bonita para escanear fácilmente.

Simplemente abre en tu navegador: `http://localhost:3000/api/qr-image`

### 5. Reiniciar Bot

**POST** `/api/restart`

Reinicia el cliente de WhatsApp (útil si hay problemas).

**Respuesta:**
```json
{
  "success": true,
  "message": "Cliente reiniciado exitosamente"
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/restart
```

### 6. Health Check

**GET** `/health`

Verifica que el servidor esté funcionando.

**Respuesta:**
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-01-09T12:00:00.000Z"
}
```

## 📧 Notificaciones por Correo

El sistema enviará correos automáticamente en los siguientes casos:

### ✅ Cuando se conecta exitosamente
- Asunto: "✅ Bot de WhatsApp Conectado - Iglesia360"
- Incluye información de la conexión

### 🚨 Cuando se desconecta
- Asunto: "🚨 Bot de WhatsApp Desconectado - Iglesia360"
- Incluye fecha/hora de desconexión
- Incluye link para obtener nuevo QR

## 🔄 Reconexión Automática

El bot está diseñado para máxima persistencia:

1. **Sesión persistente**: La sesión se guarda en `.wwebjs_auth/`, no necesitas escanear el QR cada vez
2. **Reconexión automática**: Si se desconecta, intenta reconectar después de 5 segundos
3. **Notificación por correo**: Recibes una alerta si el bot se desconecta
4. **Estado en tiempo real**: Puedes monitorear el estado con el endpoint `/api/status`

## 📂 Estructura del Proyecto

```
iglesia360-bot-api/
├── src/
│   ├── index.js                 # Servidor principal
│   ├── routes/
│   │   └── api.js              # Rutas de la API
│   ├── services/
│   │   ├── whatsappService.js  # Lógica de WhatsApp
│   │   └── emailService.js     # Servicio de correos
│   └── utils/
│       └── logger.js           # Sistema de logging
├── logs/                       # Logs de la aplicación
├── .wwebjs_auth/              # Sesión de WhatsApp (generado)
├── .env                       # Variables de entorno
├── .env.example              # Ejemplo de configuración
├── .gitignore
├── package.json
└── README.md
```

## 🔒 Seguridad

### Recomendaciones para producción:

1. **Autenticación**: Agrega autenticación a los endpoints (JWT, API Key, etc.)
2. **HTTPS**: Usa HTTPS en producción
3. **CORS**: Restringe los orígenes permitidos en CORS
4. **Rate Limiting**: Ajusta los límites según tus necesidades
5. **Variables de entorno**: Nunca subas el archivo `.env` al repositorio
6. **Firewall**: Usa un firewall para proteger el servidor

### Ejemplo de autenticación simple con API Key:

```javascript
// Middleware en src/index.js
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Aplicar a rutas específicas
app.use('/api/send-message', apiKeyAuth);
```

## 📝 Logs

Los logs se guardan en la carpeta `logs/`:

- `error.log` - Solo errores
- `combined.log` - Todos los eventos

También se muestran en consola con colores para fácil lectura.

## 🐛 Solución de Problemas

### El bot no se conecta

1. Verifica que todas las dependencias estén instaladas: `npm install`
2. Elimina la carpeta `.wwebjs_auth/` y escanea el QR nuevamente
3. Asegúrate de que no haya otro bot usando el mismo número
4. Verifica los logs en `logs/combined.log`

### No recibo correos

1. Verifica que las credenciales de Gmail sean correctas
2. Asegúrate de usar una **contraseña de aplicación**, no tu contraseña normal
3. Verifica que la verificación en dos pasos esté activada
4. Revisa los logs para ver errores de correo

### Error "Cannot find module"

Ejecuta `npm install` nuevamente para instalar todas las dependencias.

### El QR no se muestra

1. Espera unos segundos, el QR puede tardar en generarse
2. Recarga la página `/api/qr-image`
3. Verifica el estado con `/api/status`

## 🚀 Despliegue

### Opción 1: Servidor VPS (Ubuntu)

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar proyecto e instalar
cd /var/www/
git clone <tu-repo>
cd iglesia360-bot-api
npm install

# Configurar .env
nano .env

# Usar PM2 para mantener el proceso activo
sudo npm install -g pm2
pm2 start src/index.js --name iglesia360-bot
pm2 startup
pm2 save
```

### Opción 2: Docker

Crea un `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
```

Construir y ejecutar:

```bash
docker build -t iglesia360-bot .
docker run -d -p 3000:3000 --env-file .env --name iglesia360-bot iglesia360-bot
```

## 🤝 Contribuir

Si encuentras algún bug o tienes sugerencias, por favor abre un issue o pull request.

## 📄 Licencia

MIT

## 👨‍💻 Autor

Desarrollado para Iglesia360

---

## 🎉 ¡Listo!

Tu bot de WhatsApp está listo para usar. Si tienes alguna pregunta, revisa los logs o contacta al equipo de desarrollo.

**¡Bendiciones! 🙏**
