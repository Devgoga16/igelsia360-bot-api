const cron = require('node-cron');
const BillingPeriod = require('../models/BillingPeriod');
const logger = require('../utils/logger');

class BillingJobService {
  constructor() {
    this.jobs = [];
  }

  /**
   * Inicializar todos los jobs de facturación
   */
  start() {
    logger.info('📅 Iniciando jobs de facturación...');

    // Job 1: Cerrar periodo mensual automáticamente el día 1 de cada mes a las 00:01
    const closeMonthlyPeriodJob = cron.schedule('1 0 1 * *', async () => {
      await this.closePreviousMonthPeriod();
    }, {
      timezone: "America/Lima" // Ajusta a tu zona horaria
    });

    // Job 2: Verificar periodos vencidos todos los días a las 00:00
    const checkOverduePeriodsJob = cron.schedule('0 0 * * *', async () => {
      await this.checkOverduePeriods();
    }, {
      timezone: "America/Lima"
    });

    // Job 3: Enviar recordatorio de pago el día 3 de cada mes
    const paymentReminderJob = cron.schedule('0 9 3 * *', async () => {
      await this.sendPaymentReminder();
    }, {
      timezone: "America/Lima"
    });

    this.jobs.push(closeMonthlyPeriodJob, checkOverduePeriodsJob, paymentReminderJob);

    logger.info('✅ Jobs de facturación iniciados');
    logger.info('  - Cierre de periodo: día 1 de cada mes a las 00:01');
    logger.info('  - Verificación de vencidos: todos los días a las 00:00');
    logger.info('  - Recordatorio de pago: día 3 de cada mes a las 09:00');

    // Ejecutar verificación inicial al arrancar
    this.checkOverduePeriods();
  }

  /**
   * Cerrar el periodo del mes anterior automáticamente
   */
  async closePreviousMonthPeriod() {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodString = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

      logger.info(`🔒 Cerrando periodo: ${periodString}`);

      const period = await BillingPeriod.findOne({ period: periodString });

      if (!period) {
        logger.warn(`No se encontró el periodo ${periodString} para cerrar`);
        return;
      }

      if (period.status === 'closed' || period.status === 'paid') {
        logger.info(`El periodo ${periodString} ya está cerrado o pagado`);
        return;
      }

      // Cerrar periodo
      period.status = period.isPaid ? 'paid' : 'closed';
      period.closedAt = now;
      await period.save();

      logger.info(`✅ Periodo ${periodString} cerrado exitosamente`);
      logger.info(`   Total mensajes: ${period.totalMessages}`);
      logger.info(`   Límite del plan: ${period.planLimit}`);
      logger.info(`   Monto a pagar: $${period.amountDue}`);
      logger.info(`   Estado: ${period.status}`);

      // Si excede el límite y no está pagado, enviar notificación
      if (period.totalMessages > period.planLimit && !period.isPaid) {
        const extraMessages = period.totalMessages - period.planLimit;
        logger.warn(`⚠️  Periodo ${periodString} excede el límite por ${extraMessages} mensajes`);
        logger.warn(`   Fecha límite de pago: ${period.paymentDueDate.toLocaleDateString()}`);
      }

    } catch (error) {
      logger.error('Error cerrando periodo mensual:', error);
    }
  }

  /**
   * Verificar periodos vencidos (pasaron los 5 días de gracia)
   */
  async checkOverduePeriods() {
    try {
      const now = new Date();

      // Buscar periodos cerrados no pagados cuya fecha límite ya pasó
      const overduePeriods = await BillingPeriod.find({
        isPaid: false,
        paymentDueDate: { $lt: now },
        status: { $in: ['closed', 'active'] }
      });

      if (overduePeriods.length === 0) {
        logger.info('✅ No hay periodos vencidos');
        return;
      }

      logger.warn(`⚠️  Se encontraron ${overduePeriods.length} periodo(s) vencido(s)`);

      for (const period of overduePeriods) {
        period.status = 'overdue';
        await period.save();

        const daysOverdue = Math.floor((now - period.paymentDueDate) / (1000 * 60 * 60 * 24));
        
        logger.warn(`   📌 Periodo ${period.period}:`);
        logger.warn(`      - Mensajes: ${period.totalMessages}`);
        logger.warn(`      - Monto: $${period.amountDue}`);
        logger.warn(`      - Días vencido: ${daysOverdue}`);
      }

    } catch (error) {
      logger.error('Error verificando periodos vencidos:', error);
    }
  }

  /**
   * Enviar recordatorio de pago (día 3 del mes)
   */
  async sendPaymentReminder() {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodString = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

      const period = await BillingPeriod.findOne({ period: periodString });

      if (!period || period.isPaid) {
        logger.info(`Recordatorio de pago: El periodo ${periodString} ya está pagado o no existe`);
        return;
      }

      logger.info('📧 Enviando recordatorio de pago...');
      logger.info(`   Periodo: ${periodString}`);
      logger.info(`   Total mensajes: ${period.totalMessages}`);
      logger.info(`   Monto a pagar: $${period.amountDue}`);
      logger.info(`   Fecha límite: ${period.paymentDueDate.toLocaleDateString()}`);
      
      // Aquí podrías integrar con emailService para enviar un correo
      // await emailService.sendPaymentReminder(period);

    } catch (error) {
      logger.error('Error enviando recordatorio de pago:', error);
    }
  }

  /**
   * Detener todos los jobs
   */
  stop() {
    logger.info('Deteniendo jobs de facturación...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info('✅ Jobs de facturación detenidos');
  }
}

// Singleton
const billingJobService = new BillingJobService();

module.exports = billingJobService;
