const express = require('express');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const BillingPeriod = require('../models/BillingPeriod');

const router = express.Router();

/**
 * @route   POST /api/send-message
 * @desc    Enviar mensaje de WhatsApp
 * @access  Public (deberías agregar autenticación en producción)
 */
router.post('/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    // Validar campos requeridos
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los campos phoneNumber y message'
      });
    }

    // Validar que el mensaje no esté vacío
    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje no puede estar vacío'
      });
    }

    // Enviar mensaje
    const result = await whatsappService.sendMessage(phoneNumber, message);

    // Guardar en base de datos si fue exitoso
    try {
      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Crear registro del mensaje
      const messageRecord = new Message({
        phoneNumber,
        message,
        status: 'success',
        sentAt: now,
        billingPeriod,
        messageId: result.id || result._serialized || null
      });

      await messageRecord.save();

      // Actualizar o crear el periodo de facturación
      await updateBillingPeriod(billingPeriod);

      logger.info(`API: Mensaje enviado y guardado exitosamente a ${phoneNumber}`);
    } catch (dbError) {
      logger.error('Error guardando mensaje en BD (mensaje enviado exitosamente):', dbError);
      // No fallar el request si el mensaje se envió correctamente
    }

    res.json({
      success: true,
      data: result,
      message: 'Mensaje enviado exitosamente'
    });

  } catch (error) {
    // Guardar mensaje fallido en BD
    try {
      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const messageRecord = new Message({
        phoneNumber: req.body.phoneNumber,
        message: req.body.message,
        status: 'failed',
        sentAt: now,
        billingPeriod,
        errorMessage: error.message
      });

      await messageRecord.save();
    } catch (dbError) {
      logger.error('Error guardando mensaje fallido en BD:', dbError);
    }

    logger.error('Error en endpoint send-message:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar el mensaje'
    });
  }
});

/**
 * @route   GET /api/status
 * @desc    Obtener el estado del bot en tiempo real
 * @access  Public
 */
router.get('/status', (req, res) => {
  try {
    const status = whatsappService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error en endpoint status:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener el estado'
    });
  }
});

/**
 * @route   GET /api/qr
 * @desc    Obtener el código QR para conectar WhatsApp
 * @access  Public
 */
router.get('/qr', (req, res) => {
  try {
    const qrCode = whatsappService.getQRCode();
    const status = whatsappService.getStatus();

    if (!qrCode) {
      // Si no hay QR disponible, verificar el estado
      if (status.isReady) {
        return res.json({
          success: true,
          message: 'El bot ya está conectado',
          status: status.status,
          connected: true
        });
      } else if (status.isAuthenticating) {
        return res.json({
          success: false,
          message: 'Generando código QR, por favor espera...',
          status: status.status
        });
      } else {
        return res.json({
          success: false,
          message: 'No hay código QR disponible. El bot se está inicializando...',
          status: status.status
        });
      }
    }

    // Retornar el QR code
    res.json({
      success: true,
      qrCode: qrCode,
      message: 'Escanea el código QR con WhatsApp',
      status: status.status
    });

  } catch (error) {
    logger.error('Error en endpoint qr:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener el código QR'
    });
  }
});

/**
 * @route   GET /api/qr-image
 * @desc    Obtener el código QR como imagen HTML con actualizaciones en tiempo real
 * @access  Public
 */
router.get('/qr-image', (req, res) => {
  try {
    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
    
    // Página HTML con Socket.IO para actualizaciones en tiempo real
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Bot</title>
        <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            text-align: center;
            max-width: 420px;
            width: 90%;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 500;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .status-disconnected { background: #fee; color: #c33; }
          .status-qr_ready { background: #e8f5e9; color: #2e7d32; }
          .status-authenticated { background: #fff3e0; color: #e65100; }
          .status-connected { background: #e8f5e9; color: #2e7d32; }
          .status-loading { background: #f5f5f5; color: #666; }
          
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #222; margin-bottom: 8px; font-size: 24px; font-weight: 500; }
          .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; font-weight: 400; }
          
          .qr-container {
            margin: 24px 0;
            display: inline-block;
          }
          .qr-container img {
            width: 260px;
            height: 260px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
          
          .loader {
            border: 3px solid #f0f0f0;
            border-top: 3px solid #666;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 32px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .steps {
            text-align: left;
            background: #fafafa;
            padding: 16px 20px;
            border-radius: 8px;
            margin-top: 24px;
            font-size: 13px;
          }
          .steps strong { color: #444; display: block; margin-bottom: 12px; font-weight: 500; }
          .steps ol { margin: 0; padding-left: 18px; }
          .steps li { margin: 8px 0; color: #666; line-height: 1.5; }
          
          .connected-info {
            background: #fafafa;
            border: 1px solid #e0e0e0;
            padding: 16px;
            border-radius: 8px;
            margin-top: 24px;
            font-size: 13px;
          }
          .connected-info p { color: #444; margin: 6px 0; }
          .connected-info strong { color: #222; font-weight: 500; }
          
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #f0f0f0;
            color: #999;
            font-size: 11px;
          }
          
          .pulse {
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          
          #message {
            margin: 15px 0;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="status-badge" class="status-badge status-loading">Cargando...</div>
          <div id="icon" class="icon">📱</div>
          <h1 id="title">Conectando WhatsApp Bot</h1>
          <p id="subtitle" class="subtitle">Estableciendo conexión...</p>
          
          <div id="content"></div>
          <div id="message"></div>
          
          <div class="footer">
            <p>Iglesia360 Bot API • En tiempo real con WebSocket</p>
          </div>
        </div>

        <script>
          const socket = io('${baseUrl}', {
            path: '/socket.io/',
            transports: ['websocket', 'polling']
          });
          
          const statusBadge = document.getElementById('status-badge');
          const icon = document.getElementById('icon');
          const title = document.getElementById('title');
          const subtitle = document.getElementById('subtitle');
          const content = document.getElementById('content');
          const message = document.getElementById('message');
          
          // Conectado al WebSocket
          socket.on('connect', () => {
            console.log('Conectado al servidor WebSocket');
            updateMessage('🟢 Conectado al servidor', 'success');
            // Solicitar estado actual
            fetch('${baseUrl}/api/status')
              .then(r => r.json())
              .then(data => updateUI(data.data));
          });
          
          // Desconectado del WebSocket
          socket.on('disconnect', () => {
            console.log('Desconectado del servidor WebSocket');
            updateMessage('🔴 Desconectado del servidor. Reconectando...', 'error');
          });
          
          // QR actualizado
          socket.on('qr-updated', (data) => {
            console.log('QR recibido');
            showQR(data.qrCode);
          });
          
          // Estado actualizado
          socket.on('status-updated', (data) => {
            console.log('Estado actualizado:', data.status);
            updateUI(data.status);
          });
          
          // Bot conectado
          socket.on('bot-connected', (data) => {
            console.log('Bot conectado:', data.clientInfo);
            showConnected(data.clientInfo);
          });
          
          // Bot desconectado
          socket.on('bot-disconnected', (data) => {
            console.log('Bot desconectado:', data.reason);
            showDisconnected(data.reason);
          });
          
          function updateUI(status) {
            statusBadge.className = 'status-badge status-' + status.status;
            statusBadge.textContent = translateStatus(status.status);
            
            if (status.isReady) {
              showConnected(status.clientInfo);
            } else if (status.hasQR) {
              // El QR ya debería estar mostrado por el evento qr-updated
            } else if (status.isInitializing) {
              showLoading('Inicializando bot...');
            } else if (status.isAuthenticating) {
              showLoading('Generando código QR...');
            } else {
              showLoading('Esperando...');
            }
          }
          
          function showQR(qrCode) {
            icon.textContent = '📱';
            title.textContent = 'Escanea el Código QR';
            subtitle.textContent = 'Usa WhatsApp en tu teléfono para escanear';
            
            content.innerHTML = \`
              <div class="qr-container">
                <img src="\${qrCode}" alt="QR Code" />
              </div>
              <div class="steps">
                <strong>Pasos para conectar:</strong>
                <ol>
                  <li>Abre WhatsApp en tu teléfono</li>
                  <li>Toca <strong>Menú</strong> o <strong>Configuración</strong></li>
                  <li>Selecciona <strong>Dispositivos vinculados</strong></li>
                  <li>Toca <strong>Vincular un dispositivo</strong></li>
                  <li>Apunta tu teléfono a esta pantalla</li>
                </ol>
              </div>
            \`;
            
            updateMessage('✨ Código QR listo. Escanea con tu teléfono.', 'info');
          }
          
          function showLoading(text) {
            icon.textContent = '⏳';
            title.textContent = text;
            subtitle.textContent = 'Por favor espera...';
            content.innerHTML = '<div class="loader pulse"></div>';
          }
          
          function showConnected(clientInfo) {
            icon.textContent = '✅';
            title.textContent = '¡Bot Conectado!';
            subtitle.textContent = 'El bot está funcionando correctamente';
            statusBadge.className = 'status-badge status-connected';
            statusBadge.textContent = 'Conectado';
            
            if (clientInfo) {
              content.innerHTML = \`
                <div class="connected-info">
                  <p><strong>✓ Estado:</strong> Activo y listo</p>
                  <p><strong>📱 Nombre:</strong> \${clientInfo.name || 'N/A'}</p>
                  <p><strong>📞 Número:</strong> +\${clientInfo.number || 'N/A'}</p>
                  <p><strong>💻 Plataforma:</strong> \${clientInfo.platform || 'N/A'}</p>
                </div>
              \`;
            } else {
              content.innerHTML = \`
                <div class="connected-info">
                  <p><strong>✓ Estado:</strong> Conectado y operativo</p>
                </div>
              \`;
            }
            
            updateMessage('🎉 Bot conectado correctamente', 'success');
          }
          
          function showDisconnected(reason) {
            icon.textContent = '⚠️';
            title.textContent = 'Bot Desconectado';
            subtitle.textContent = 'Reconectando automáticamente...';
            content.innerHTML = '<div class="loader pulse"></div>';
            updateMessage(\`⚠️ Desconectado: \${reason || 'Desconocido'}\`, 'warning');
          }
          
          function translateStatus(status) {
            const translations = {
              'disconnected': 'Desconectado',
              'qr_ready': 'QR Listo',
              'authenticated': 'Autenticado',
              'connected': 'Conectado',
              'loading': 'Cargando',
              'error': 'Error'
            };
            return translations[status] || status;
          }
          
          function updateMessage(text, type) {
            message.textContent = text;
            message.style.color = type === 'success' ? '#6bcf7f' : 
                                  type === 'error' ? '#ff6b6b' : 
                                  type === 'warning' ? '#ffd93d' : '#666';
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('Error en endpoint qr-image:', error);
    res.status(500).send('Error al cargar la página');
  }
});

/**
 * @route   POST /api/restart
 * @desc    Reiniciar el cliente de WhatsApp
 * @access  Public (deberías agregar autenticación en producción)
 */
router.post('/restart', async (req, res) => {
  try {
    logger.info('API: Reiniciando cliente de WhatsApp...');
    await whatsappService.restart();
    
    res.json({
      success: true,
      message: 'Cliente reiniciado exitosamente'
    });

  } catch (error) {
    logger.error('Error en endpoint restart:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al reiniciar el cliente'
    });
  }
});

/**
 * @route   POST /api/clean-session
 * @desc    Limpiar sesión y reiniciar el bot
 * @access  Public (deberías agregar autenticación en producción)
 */
router.post('/clean-session', async (req, res) => {
  try {
    logger.info('API: Limpiando sesión...');
    const cleaned = await whatsappService.cleanSession();
    
    if (cleaned) {
      // Reiniciar después de limpiar
      setTimeout(() => {
        whatsappService.initializeClient();
      }, 2000);
      
      res.json({
        success: true,
        message: 'Sesión limpiada exitosamente. El bot se está reiniciando...'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al limpiar la sesión'
      });
    }

  } catch (error) {
    logger.error('Error en endpoint clean-session:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al limpiar la sesión'
    });
  }
});

// ============================================================
// FUNCIONES AUXILIARES PARA FACTURACIÓN
// ============================================================

/**
 * Actualiza o crea el periodo de facturación actual
 */
async function updateBillingPeriod(periodString) {
  try {
    const [year, month] = periodString.split('-').map(Number);
    
    // Calcular fechas del periodo
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Último día del mes
    
    // Fecha límite de pago: día 5 del siguiente mes
    const paymentDueDate = new Date(year, month, 5, 23, 59, 59, 999);

    let period = await BillingPeriod.findOne({ period: periodString });

    if (!period) {
      // Crear nuevo periodo
      period = new BillingPeriod({
        period: periodString,
        startDate,
        endDate,
        totalMessages: 1,
        planLimit: 500,
        status: 'active',
        paymentDueDate
      });
    } else {
      // Incrementar contador de mensajes
      period.totalMessages += 1;
    }

    period.calculateAmount();
    await period.save();

    logger.info(`Periodo ${periodString} actualizado: ${period.totalMessages} mensajes`);
    return period;

  } catch (error) {
    logger.error('Error actualizando periodo de facturación:', error);
    throw error;
  }
}

// ============================================================
// ENDPOINTS DE FACTURACIÓN
// ============================================================

/**
 * @route   GET /api/billing/messages/:period
 * @desc    Obtener todos los mensajes de un periodo
 * @param   period - Formato YYYY-MM (ej: 2026-01)
 */
router.get('/billing/messages/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const { status } = req.query; // Opcional: 'success' o 'failed'

    // Validar formato de periodo
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de periodo inválido. Use YYYY-MM'
      });
    }

    const query = { billingPeriod: period };
    if (status) {
      query.status = status;
    }

    const messages = await Message.find(query)
      .sort({ sentAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        period,
        totalMessages: messages.length,
        messages
      }
    });

  } catch (error) {
    logger.error('Error obteniendo mensajes del periodo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mensajes del periodo'
    });
  }
});

/**
 * @route   GET /api/billing/period/:period
 * @desc    Obtener información del periodo de facturación
 * @param   period - Formato YYYY-MM (ej: 2026-01)
 */
router.get('/billing/period/:period', async (req, res) => {
  try {
    const { period } = req.params;

    // Validar formato de periodo
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de periodo inválido. Use YYYY-MM'
      });
    }

    const billingPeriod = await BillingPeriod.findOne({ period }).lean();

    if (!billingPeriod) {
      return res.status(404).json({
        success: false,
        error: 'Periodo no encontrado'
      });
    }

    // Calcular si está vencido
    const now = new Date();
    const isOverdue = now > billingPeriod.paymentDueDate && !billingPeriod.isPaid;

    res.json({
      success: true,
      data: {
        ...billingPeriod,
        isOverdue,
        exceedsLimit: billingPeriod.totalMessages > billingPeriod.planLimit,
        extraMessages: Math.max(0, billingPeriod.totalMessages - billingPeriod.planLimit)
      }
    });

  } catch (error) {
    logger.error('Error obteniendo periodo de facturación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener periodo de facturación'
    });
  }
});

/**
 * @route   GET /api/billing/periods
 * @desc    Obtener todos los periodos de facturación
 */
router.get('/billing/periods', async (req, res) => {
  try {
    const { status } = req.query; // Opcional: 'paid', 'overdue', 'active', 'closed'

    const query = {};
    if (status) {
      query.status = status;
    }

    const periods = await BillingPeriod.find(query)
      .sort({ period: -1 })
      .lean();

    const now = new Date();
    const periodsWithStatus = periods.map(period => ({
      ...period,
      isOverdue: now > period.paymentDueDate && !period.isPaid,
      exceedsLimit: period.totalMessages > period.planLimit,
      extraMessages: Math.max(0, period.totalMessages - period.planLimit)
    }));

    res.json({
      success: true,
      data: {
        totalPeriods: periodsWithStatus.length,
        periods: periodsWithStatus
      }
    });

  } catch (error) {
    logger.error('Error obteniendo periodos de facturación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener periodos de facturación'
    });
  }
});

/**
 * @route   POST /api/billing/pay/:period
 * @desc    Marcar un periodo como pagado
 * @param   period - Formato YYYY-MM (ej: 2026-01)
 */
router.post('/billing/pay/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const { notes } = req.body;

    // Validar formato de periodo
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de periodo inválido. Use YYYY-MM'
      });
    }

    const billingPeriod = await BillingPeriod.findOne({ period });

    if (!billingPeriod) {
      return res.status(404).json({
        success: false,
        error: 'Periodo no encontrado'
      });
    }

    if (billingPeriod.isPaid) {
      return res.status(400).json({
        success: false,
        error: 'Este periodo ya está pagado',
        data: {
          paidAt: billingPeriod.paidAt
        }
      });
    }

    // Actualizar notas si se proporcionan
    if (notes) {
      billingPeriod.notes = notes;
    }

    // Marcar como pagado
    await billingPeriod.markAsPaid();

    logger.info(`Periodo ${period} marcado como pagado`);

    res.json({
      success: true,
      message: 'Periodo marcado como pagado exitosamente',
      data: billingPeriod
    });

  } catch (error) {
    logger.error('Error marcando periodo como pagado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el pago del periodo'
    });
  }
});

/**
 * @route   GET /api/billing/current
 * @desc    Obtener información del periodo actual
 */
router.get('/billing/current', async (req, res) => {
  try {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let billingPeriod = await BillingPeriod.findOne({ period: currentPeriod }).lean();

    if (!billingPeriod) {
      // Crear periodo si no existe
      await updateBillingPeriod(currentPeriod);
      billingPeriod = await BillingPeriod.findOne({ period: currentPeriod }).lean();
    }

    const exceedsLimit = billingPeriod.totalMessages > billingPeriod.planLimit;
    const remainingMessages = Math.max(0, billingPeriod.planLimit - billingPeriod.totalMessages);

    res.json({
      success: true,
      data: {
        ...billingPeriod,
        exceedsLimit,
        remainingMessages,
        extraMessages: Math.max(0, billingPeriod.totalMessages - billingPeriod.planLimit),
        usagePercentage: ((billingPeriod.totalMessages / billingPeriod.planLimit) * 100).toFixed(2)
      }
    });

  } catch (error) {
    logger.error('Error obteniendo periodo actual:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener periodo actual'
    });
  }
});

module.exports = router;
