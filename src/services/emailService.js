const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;
      
      if (!emailUser || !emailPass) {
        logger.warn('Configuración de correo no encontrada. El servicio de notificaciones está deshabilitado.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      this.isConfigured = true;
      logger.info('Servicio de correo configurado correctamente');
    } catch (error) {
      logger.error('Error al configurar el servicio de correo:', error);
    }
  }

  async sendDisconnectionAlert() {
    if (!this.isConfigured) {
      logger.warn('No se puede enviar correo: servicio no configurado');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: '🚨 Bot de WhatsApp Desconectado - Iglesia360',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #e74c3c; margin-top: 0;">
                ⚠️ Alerta de Desconexión
              </h2>
              <p style="font-size: 16px; color: #333;">
                El bot de WhatsApp de <strong>Iglesia360</strong> se ha desconectado.
              </p>
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  <strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' })}
                </p>
              </div>
              <p style="font-size: 14px; color: #666;">
                Por favor, escanea el código QR nuevamente para reconectar el bot.
              </p>
              <p style="font-size: 14px; color: #666;">
                Puedes obtener el código QR accediendo a: 
                <a href="${process.env.API_URL || 'http://localhost:3000'}/api/qr" style="color: #3498db;">
                  ${process.env.API_URL || 'http://localhost:3000'}/api/qr
                </a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999; margin-bottom: 0;">
                Este es un mensaje automático del sistema de monitoreo de Iglesia360.
              </p>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Correo de alerta enviado exitosamente: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error al enviar correo de alerta:', error);
      return false;
    }
  }

  async sendConnectionSuccess() {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: '✅ Bot de WhatsApp Conectado - Iglesia360',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #27ae60; margin-top: 0;">
                ✅ Conexión Exitosa
              </h2>
              <p style="font-size: 16px; color: #333;">
                El bot de WhatsApp de <strong>Iglesia360</strong> se ha conectado exitosamente.
              </p>
              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #155724;">
                  <strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' })}
                </p>
              </div>
              <p style="font-size: 14px; color: #666;">
                El bot está listo para enviar y recibir mensajes.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999; margin-bottom: 0;">
                Este es un mensaje automático del sistema de monitoreo de Iglesia360.
              </p>
            </div>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Correo de conexión exitosa enviado: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error al enviar correo de conexión:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
