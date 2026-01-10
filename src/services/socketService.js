const { Server } = require('socket.io');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = 0;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      path: '/socket.io/'
    });

    this.io.on('connection', (socket) => {
      this.connectedClients++;
      logger.info(`Cliente WebSocket conectado. Total: ${this.connectedClients}`);

      socket.on('disconnect', () => {
        this.connectedClients--;
        logger.info(`Cliente WebSocket desconectado. Total: ${this.connectedClients}`);
      });

      // Enviar estado inicial cuando un cliente se conecta
      socket.on('request-status', () => {
        logger.debug('Cliente solicita estado actual');
      });
    });

    logger.info('Socket.IO inicializado correctamente');
  }

  // Emitir QR a todos los clientes conectados
  emitQR(qrCode) {
    if (this.io) {
      this.io.emit('qr-updated', { qrCode, timestamp: new Date().toISOString() });
      logger.info('QR emitido a clientes conectados');
    }
  }

  // Emitir estado del bot
  emitStatus(status) {
    if (this.io) {
      this.io.emit('status-updated', { status, timestamp: new Date().toISOString() });
      logger.debug(`Estado emitido: ${status.status}`);
    }
  }

  // Emitir mensaje de conexión exitosa
  emitConnected(clientInfo) {
    if (this.io) {
      this.io.emit('bot-connected', { clientInfo, timestamp: new Date().toISOString() });
      logger.info('Evento de conexión emitido');
    }
  }

  // Emitir desconexión
  emitDisconnected(reason) {
    if (this.io) {
      this.io.emit('bot-disconnected', { reason, timestamp: new Date().toISOString() });
      logger.info('Evento de desconexión emitido');
    }
  }

  // Emitir logs en tiempo real (opcional)
  emitLog(level, message) {
    if (this.io) {
      this.io.emit('log', { level, message, timestamp: new Date().toISOString() });
    }
  }

  // Obtener número de clientes conectados
  getConnectedClients() {
    return this.connectedClients;
  }
}

// Exportar instancia única (Singleton)
module.exports = new SocketService();
