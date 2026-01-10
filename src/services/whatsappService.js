const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.isAuthenticating = false;
    this.connectionStatus = 'disconnected';
    this.lastDisconnectTime = null;
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.initializeClient();
  }

  async initializeClient() {
    // Prevenir múltiples inicializaciones simultáneas
    if (this.isInitializing) {
      logger.warn('Ya hay una inicialización en progreso, ignorando...');
      return;
    }

    this.isInitializing = true;

    try {
      logger.info('Inicializando cliente de WhatsApp...');
      
      // Si hay un cliente existente, destruirlo primero
      if (this.client) {
        logger.info('Cerrando cliente existente...');
        try {
          await this.client.destroy();
          this.client = null;
          // Esperar un poco para que se liberen los recursos
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          logger.warn('Error al cerrar cliente existente:', error.message);
        }
      }
      
      // Configuración del cliente con persistencia máxima
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: process.env.SESSION_NAME || 'iglesia360-session',
          dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update',
            '--disable-translate',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          timeout: 60000
        }
      });

      this.setupEventHandlers();
      
      // Inicializar con manejo de errores mejorado
      await this.client.initialize();
      
      this.isInitializing = false;
      this.reconnectAttempts = 0;
      logger.info('Cliente inicializado exitosamente');
      
    } catch (error) {
      this.isInitializing = false;
      logger.error('Error al inicializar el cliente:', error);
      this.connectionStatus = 'error';
      
      // Detectar errores específicos que requieren limpieza
      const errorMessage = error.message || error.toString();
      const needsCleanup = 
        errorMessage.includes('browser is already running') ||
        errorMessage.includes('EBUSY') ||
        errorMessage.includes('resource busy or locked') ||
        errorMessage.includes('lockfile');
      
      if (needsCleanup) {
        logger.warn('Detectado error de bloqueo. Realizando limpieza automática...');
        await this.cleanSession();
        
        // Reintentar inmediatamente después de limpiar
        setTimeout(() => {
          logger.info('Reintentando después de limpieza...');
          this.reconnectAttempts = 0; // Reset después de limpieza
          this.initializeClient();
        }, 5000);
        return;
      }
      
      // Reintentar con backoff exponencial para otros errores
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(10000 * this.reconnectAttempts, 60000);
        logger.info(`Reintentando en ${delay / 1000} segundos... (Intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          this.initializeClient();
        }, delay);
      } else {
        logger.error('Máximo número de reintentos alcanzado. Por favor, reinicia el servidor manualmente.');
      }
    }
  }

  // Función para limpiar la sesión automáticamente
  async cleanSession() {
    try {
      logger.info('🧹 Iniciando limpieza automática de sesión...');
      
      const authPath = path.join(process.cwd(), '.wwebjs_auth');
      const cachePath = path.join(process.cwd(), '.wwebjs_cache');
      
      // Cerrar cliente si existe
      if (this.client) {
        try {
          await this.client.destroy();
          this.client = null;
        } catch (e) {
          logger.warn('Error al cerrar cliente durante limpieza:', e.message);
        }
      }
      
      // Esperar a que se liberen recursos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Eliminar directorio de autenticación
      if (fs.existsSync(authPath)) {
        logger.info('Eliminando archivos de sesión...');
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
          logger.info('✓ Sesión eliminada');
        } catch (error) {
          logger.error('Error al eliminar sesión:', error.message);
          // Intentar con método alternativo
          await this.forceDeleteDirectory(authPath);
        }
      }
      
      // Eliminar directorio de cache
      if (fs.existsSync(cachePath)) {
        logger.info('Eliminando cache...');
        try {
          fs.rmSync(cachePath, { recursive: true, force: true });
          logger.info('✓ Cache eliminado');
        } catch (error) {
          logger.warn('No se pudo eliminar cache:', error.message);
        }
      }
      
      logger.info('✅ Limpieza automática completada');
      return true;
      
    } catch (error) {
      logger.error('Error durante limpieza automática:', error);
      return false;
    }
  }

  // Método auxiliar para forzar eliminación de directorios
  async forceDeleteDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) return;
      
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          await this.forceDeleteDirectory(filePath);
        } else {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // Ignorar errores en archivos individuales
          }
        }
      }
      
      try {
        fs.rmdirSync(dirPath);
        logger.info(`✓ Directorio ${dirPath} eliminado`);
      } catch (e) {
        logger.warn(`No se pudo eliminar directorio ${dirPath}`);
      }
    } catch (error) {
      logger.error('Error en forceDeleteDirectory:', error.message);
    }
  }

  setupEventHandlers() {
    // Evento: QR Code generado
    this.client.on('qr', async (qr) => {
      logger.info('Código QR generado');
      this.isAuthenticating = true;
      this.connectionStatus = 'qr_ready';
      
      try {
        // Generar QR en formato base64
        this.qrCode = await qrcode.toDataURL(qr);
        logger.info('Código QR convertido a base64 y almacenado');
      } catch (error) {
        logger.error('Error al generar código QR:', error);
      }
    });

    // Evento: Cliente autenticado
    this.client.on('authenticated', () => {
      logger.info('Cliente autenticado exitosamente');
      this.isAuthenticating = false;
      this.connectionStatus = 'authenticated';
      this.qrCode = null;
    });

    // Evento: Fallo de autenticación
    this.client.on('auth_failure', async (msg) => {
      logger.error('Error de autenticación:', msg);
      this.connectionStatus = 'auth_failure';
      this.qrCode = null;
      this.isAuthenticating = false;
      
      // Si falla la autenticación múltiples veces, limpiar sesión
      if (this.reconnectAttempts >= 2) {
        logger.warn('Múltiples fallos de autenticación. Limpiando sesión...');
        await this.cleanSession();
        this.reconnectAttempts = 0;
        
        setTimeout(() => {
          this.initializeClient();
        }, 5000);
      }
    });

    // Evento: Cliente listo
    this.client.on('ready', async () => {
      logger.info('Cliente de WhatsApp listo y conectado');
      this.isReady = true;
      this.connectionStatus = 'connected';
      this.qrCode = null;
      
      // Enviar notificación de conexión exitosa
      await emailService.sendConnectionSuccess();
      
      // Obtener información del cliente
      const clientInfo = this.client.info;
      logger.info(`Conectado como: ${clientInfo.pushname} (${clientInfo.wid.user})`);
    });

    // Evento: Cliente desconectado
    this.client.on('disconnected', async (reason) => {
      logger.warn(`Cliente desconectado. Razón: ${reason}`);
      this.isReady = false;
      this.connectionStatus = 'disconnected';
      this.lastDisconnectTime = new Date();
      
      // Enviar alerta por correo
      await emailService.sendDisconnectionAlert();
      
      // Si la desconexión es por logout o conflicto, limpiar sesión
      const reasonStr = reason ? reason.toString().toLowerCase() : '';
      const needsCleanup = 
        reasonStr.includes('logout') || 
        reasonStr.includes('conflict') ||
        reasonStr.includes('removed');
      
      if (needsCleanup) {
        logger.warn('Desconexión permanente detectada. Limpiando sesión...');
        await this.cleanSession();
      }
      
      // Intentar reconectar después de 10 segundos, solo si no está ya inicializando
      if (!this.isInitializing) {
        setTimeout(() => {
          logger.info('Intentando reconectar después de desconexión...');
          this.reconnectAttempts = 0; // Reset intentos para desconexión normal
          this.initializeClient();
        }, 10000);
      }
    });

    // Evento: Cambio de estado
    this.client.on('change_state', (state) => {
      logger.info(`Estado del cliente cambiado a: ${state}`);
    });

    // Evento: Cargando pantalla
    this.client.on('loading_screen', (percent, message) => {
      logger.info(`Cargando: ${percent}% - ${message}`);
      this.connectionStatus = 'loading';
    });

    // Evento: Mensaje recibido (opcional: para logging)
    this.client.on('message', async (message) => {
      logger.debug(`Mensaje recibido de ${message.from}: ${message.body.substring(0, 50)}...`);
    });

    // Evento: Error general
    this.client.on('error', (error) => {
      logger.error('Error en el cliente de WhatsApp:', error);
    });

    // Evento: Error de Puppeteer
    this.client.on('remote_session_saved', () => {
      logger.info('Sesión remota guardada exitosamente');
    });
  }

  // Método para enviar mensaje
  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('El cliente no está listo. Por favor, escanea el código QR primero.');
    }

    try {
      // Formatear número de teléfono
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Si no tiene código de país, agregar 51 (Perú)
      if (formattedNumber.length === 9) {
        formattedNumber = '51' + formattedNumber;
      }
      
      // Agregar @c.us al final
      const chatId = formattedNumber + '@c.us';
      
      logger.info(`Enviando mensaje a ${chatId}`);
      
      // Verificar si el número es válido
      const isRegistered = await this.client.isRegisteredUser(chatId);
      
      if (!isRegistered) {
        throw new Error(`El número ${phoneNumber} no está registrado en WhatsApp`);
      }
      
      // Enviar mensaje
      const result = await this.client.sendMessage(chatId, message);
      
      logger.info(`Mensaje enviado exitosamente a ${phoneNumber}`);
      
      return {
        success: true,
        messageId: result.id._serialized,
        timestamp: result.timestamp,
        to: phoneNumber
      };
      
    } catch (error) {
      logger.error(`Error al enviar mensaje a ${phoneNumber}:`, error);
      throw error;
    }
  }

  // Método para obtener el código QR
  getQRCode() {
    return this.qrCode;
  }

  // Método para obtener el estado
  getStatus() {
    const status = {
      status: this.connectionStatus,
      isReady: this.isReady,
      isAuthenticating: this.isAuthenticating,
      isInitializing: this.isInitializing,
      hasQR: this.qrCode !== null,
      lastDisconnect: this.lastDisconnectTime,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.isReady ? process.uptime() : 0
    };

    if (this.isReady && this.client && this.client.info) {
      status.clientInfo = {
        name: this.client.info.pushname,
        number: this.client.info.wid.user,
        platform: this.client.info.platform
      };
    }

    return status;
  }

  // Método para cerrar la conexión
  async destroy() {
    if (this.client) {
      logger.info('Cerrando cliente de WhatsApp...');
      await this.client.destroy();
      this.isReady = false;
      this.connectionStatus = 'disconnected';
    }
  }

  // Método para obtener información del cliente
  getClientInfo() {
    if (!this.isReady) {
      return null;
    }
    return this.client.info;
  }

  // Método para reiniciar el cliente
  async restart() {
    logger.info('Reiniciando cliente de WhatsApp...');
    this.reconnectAttempts = 0;
    await this.destroy();
    setTimeout(() => {
      this.initializeClient();
    }, 3000);
  }
}

// Exportar una instancia única (Singleton)
module.exports = new WhatsAppService();
