const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Ya existe una conexión a MongoDB');
        return;
      }

      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot';

      await mongoose.connect(mongoUri);

      this.isConnected = true;
      logger.info('✅ Conectado a MongoDB exitosamente');

      mongoose.connection.on('error', (err) => {
        logger.error('Error en conexión MongoDB:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB desconectado');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconectado');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('Error conectando a MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected) {
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Desconectado de MongoDB');
    } catch (error) {
      logger.error('Error desconectando de MongoDB:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      status: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
    };
  }
}

// Singleton
const databaseService = new DatabaseService();

module.exports = databaseService;
