const express = require('express');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

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

    logger.info(`API: Mensaje enviado exitosamente a ${phoneNumber}`);

    res.json({
      success: true,
      data: result,
      message: 'Mensaje enviado exitosamente'
    });

  } catch (error) {
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
 * @desc    Obtener el código QR como imagen HTML para mostrar en navegador
 * @access  Public
 */
router.get('/qr-image', (req, res) => {
  try {
    const qrCode = whatsappService.getQRCode();
    const status = whatsappService.getStatus();

    if (!qrCode) {
      if (status.isReady) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Bot - Conectado</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
              }
              .success-icon {
                font-size: 80px;
                color: #25D366;
                margin-bottom: 20px;
              }
              h1 { color: #333; margin-bottom: 10px; }
              p { color: #666; font-size: 16px; }
              .info { 
                background: #f0f0f0; 
                padding: 15px; 
                border-radius: 10px; 
                margin-top: 20px;
                text-align: left;
              }
              .info strong { color: #25D366; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Bot Conectado</h1>
              <p>El bot de WhatsApp está activo y funcionando correctamente.</p>
              <div class="info">
                <p><strong>Estado:</strong> Conectado</p>
                <p><strong>Nombre:</strong> ${status.clientInfo?.name || 'N/A'}</p>
                <p><strong>Número:</strong> +${status.clientInfo?.number || 'N/A'}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      }
      
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="3">
          <title>WhatsApp Bot - Cargando</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            .loader {
              border: 5px solid #f3f3f3;
              border-top: 5px solid #25D366;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="loader"></div>
            <h1>Generando Código QR</h1>
            <p>Por favor espera mientras se genera el código QR...</p>
            <p><small>Esta página se actualizará automáticamente</small></p>
          </div>
        </body>
        </html>
      `);
    }

    // Mostrar QR Code
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Bot - Escanear QR</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .qr-code {
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            display: inline-block;
          }
          .qr-code img {
            width: 300px;
            height: 300px;
            border: 3px solid #25D366;
            border-radius: 10px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          .instructions {
            color: #666;
            margin: 20px 0;
            line-height: 1.6;
          }
          .steps {
            text-align: left;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
          }
          .steps ol {
            margin: 0;
            padding-left: 20px;
          }
          .steps li {
            margin: 10px 0;
            color: #555;
          }
          .whatsapp-icon {
            font-size: 50px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="whatsapp-icon">📱</div>
          <h1>Conectar WhatsApp</h1>
          <p class="instructions">
            Escanea el código QR con tu aplicación de WhatsApp
          </p>
          
          <div class="qr-code">
            <img src="${qrCode}" alt="QR Code" />
          </div>
          
          <div class="steps">
            <strong>Pasos para conectar:</strong>
            <ol>
              <li>Abre WhatsApp en tu teléfono</li>
              <li>Toca <strong>Menú</strong> o <strong>Configuración</strong></li>
              <li>Selecciona <strong>Dispositivos vinculados</strong></li>
              <li>Toca <strong>Vincular un dispositivo</strong></li>
              <li>Apunta tu teléfono hacia esta pantalla para escanear el código</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('Error en endpoint qr-image:', error);
    res.status(500).send('Error al obtener el código QR');
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

module.exports = router;
