require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====

// Helmet para seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar para permitir imágenes base64 del QR
}));

// CORS
app.use(cors({
  origin: '*', // En producción, especifica los dominios permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting para proteger la API
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 solicitudes por ventana
  message: {
    success: false,
    error: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiting solo a endpoints de envío
app.use('/api/send-message', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10, // 10 mensajes por minuto
  message: {
    success: false,
    error: 'Límite de mensajes alcanzado. Por favor espera un minuto.'
  }
}));

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ===== RUTAS =====

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de WhatsApp Bot - Iglesia360',
    version: '1.0.0',
    endpoints: {
      status: {
        method: 'GET',
        path: '/api/status',
        description: 'Obtener el estado del bot en tiempo real'
      },
      sendMessage: {
        method: 'POST',
        path: '/api/send-message',
        description: 'Enviar mensaje de WhatsApp',
        body: {
          phoneNumber: 'Número de teléfono (con o sin código de país)',
          message: 'Mensaje a enviar'
        }
      },
      qr: {
        method: 'GET',
        path: '/api/qr',
        description: 'Obtener código QR en formato JSON (base64)'
      },
      qrImage: {
        method: 'GET',
        path: '/api/qr-image',
        description: 'Ver código QR en el navegador'
      },
      restart: {
        method: 'POST',
        path: '/api/restart',
        description: 'Reiniciar el cliente de WhatsApp'
      },
      cleanSession: {
        method: 'POST',
        path: '/api/clean-session',
        description: 'Limpiar sesión y reiniciar (útil para resolver errores de bloqueo)'
      }
    },
    documentation: 'Ver README.md para más información'
  });
});

// Rutas de la API
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ===== MANEJO DE ERRORES =====

// 404 - Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===== INICIO DEL SERVIDOR =====

const server = app.listen(PORT, () => {
  logger.info('='.repeat(50));
  logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
  logger.info(`📱 API de WhatsApp Bot - Iglesia360`);
  logger.info(`🌐 URL: http://localhost:${PORT}`);
  logger.info(`📄 Documentación: http://localhost:${PORT}`);
  logger.info(`🔗 Ver QR: http://localhost:${PORT}/api/qr-image`);
  logger.info('='.repeat(50));
});

// Manejo de señales de terminación
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} recibido. Cerrando servidor...`);
  
  server.close(async () => {
    logger.info('Servidor HTTP cerrado');
    
    // Importar y cerrar el servicio de WhatsApp
    const whatsappService = require('./services/whatsappService');
    await whatsappService.destroy();
    
    logger.info('Aplicación cerrada correctamente');
    process.exit(0);
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.error('Forzando cierre de la aplicación...');
    process.exit(1);
  }, 10000);
};

// Escuchar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app;
