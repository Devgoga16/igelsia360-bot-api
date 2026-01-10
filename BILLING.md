# Sistema de Facturación - WhatsApp Bot API

## 📊 Descripción

Sistema de facturación automatizado para cobrar por mensajes enviados a través del bot de WhatsApp. Incluye registro de mensajes, gestión de periodos de facturación y jobs automáticos.

## 🎯 Características

- **Registro automático de mensajes**: Cada mensaje enviado se guarda en MongoDB con todos sus datos
- **Periodos mensuales**: Facturación del día 1 al último día de cada mes
- **Plan de 500 mensajes**: Se cobran mensajes que excedan este límite
- **Cierre automático**: Los periodos se cierran automáticamente el día 1 del mes siguiente
- **Ventana de pago**: 5 días (del 1 al 5) para realizar el pago
- **Jobs automatizados**: Verificación de periodos vencidos y recordatorios

## 📋 Endpoints de Facturación

### 1. **Periodo Actual**
```http
GET /api/billing/current
```

Obtiene información del periodo actual:
```json
{
  "success": true,
  "data": {
    "period": "2026-01",
    "totalMessages": 450,
    "planLimit": 500,
    "remainingMessages": 50,
    "usagePercentage": "90.00",
    "status": "active",
    "isPaid": false
  }
}
```

### 2. **Información de Periodo Específico**
```http
GET /api/billing/period/:period
```

Ejemplo: `/api/billing/period/2026-01`

```json
{
  "success": true,
  "data": {
    "period": "2026-01",
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.999Z",
    "totalMessages": 620,
    "planLimit": 500,
    "isPaid": false,
    "status": "closed",
    "paymentDueDate": "2026-02-05T23:59:59.999Z",
    "amountDue": 6.00,
    "isOverdue": false,
    "exceedsLimit": true,
    "extraMessages": 120
  }
}
```

### 3. **Mensajes de un Periodo**
```http
GET /api/billing/messages/:period?status=success
```

Parámetros query opcionales:
- `status`: `success` o `failed`

Ejemplo: `/api/billing/messages/2026-01?status=success`

```json
{
  "success": true,
  "data": {
    "period": "2026-01",
    "totalMessages": 620,
    "messages": [
      {
        "_id": "...",
        "phoneNumber": "51987654321",
        "message": "Hola, este es un mensaje de prueba",
        "status": "success",
        "sentAt": "2026-01-15T10:30:00.000Z",
        "billingPeriod": "2026-01",
        "messageId": "..."
      }
    ]
  }
}
```

### 4. **Todos los Periodos**
```http
GET /api/billing/periods?status=overdue
```

Parámetros query opcionales:
- `status`: `paid`, `overdue`, `active`, `closed`

```json
{
  "success": true,
  "data": {
    "totalPeriods": 3,
    "periods": [
      {
        "period": "2026-01",
        "totalMessages": 620,
        "isPaid": false,
        "status": "closed",
        "isOverdue": false,
        "exceedsLimit": true,
        "extraMessages": 120
      }
    ]
  }
}
```

### 5. **Pagar Periodo**
```http
POST /api/billing/pay/:period
```

Body (opcional):
```json
{
  "notes": "Pago recibido vía transferencia bancaria"
}
```

Respuesta:
```json
{
  "success": true,
  "message": "Periodo marcado como pagado exitosamente",
  "data": {
    "period": "2026-01",
    "isPaid": true,
    "status": "paid",
    "paidAt": "2026-02-03T14:25:30.000Z",
    "notes": "Pago recibido vía transferencia bancaria"
  }
}
```

## ⚙️ Jobs Automatizados

### 1. **Cierre de Periodo Mensual**
- **Frecuencia**: Día 1 de cada mes a las 00:01
- **Acción**: Cierra el periodo del mes anterior automáticamente
- **Zona horaria**: America/Lima (configurable)

### 2. **Verificación de Periodos Vencidos**
- **Frecuencia**: Todos los días a las 00:00
- **Acción**: Marca periodos como `overdue` si pasaron los 5 días de gracia

### 3. **Recordatorio de Pago**
- **Frecuencia**: Día 3 de cada mes a las 09:00
- **Acción**: Envía recordatorio para pagar el periodo anterior

## 📊 Modelo de Datos

### Message
```javascript
{
  phoneNumber: String,        // Número de teléfono
  message: String,            // Contenido del mensaje
  status: String,             // 'success' o 'failed'
  sentAt: Date,               // Fecha/hora de envío
  billingPeriod: String,      // 'YYYY-MM'
  messageId: String,          // ID de WhatsApp (opcional)
  errorMessage: String        // Error si falló (opcional)
}
```

### BillingPeriod
```javascript
{
  period: String,             // 'YYYY-MM'
  startDate: Date,            // Inicio del periodo
  endDate: Date,              // Fin del periodo
  totalMessages: Number,      // Total de mensajes del periodo
  planLimit: Number,          // Límite del plan (500)
  isPaid: Boolean,            // Si está pagado
  paidAt: Date,               // Fecha de pago
  status: String,             // 'active', 'closed', 'overdue', 'paid'
  paymentDueDate: Date,       // Fecha límite de pago
  closedAt: Date,             // Fecha de cierre
  amountDue: Number,          // Monto a pagar
  notes: String               // Notas adicionales
}
```

## 💰 Cálculo de Facturación

- **Plan base**: 500 mensajes incluidos
- **Mensajes extra**: $0.05 por mensaje adicional (configurable)
- **Ejemplo**: 
  - Mensajes enviados: 620
  - Mensajes extra: 120
  - Monto a pagar: 120 × $0.05 = **$6.00**

Para cambiar el precio por mensaje, edita el método `calculateAmount()` en [src/models/BillingPeriod.js](src/models/BillingPeriod.js):

```javascript
const pricePerExtraMessage = 0.05; // Cambiar aquí
```

## 🔧 Configuración

### Variables de Entorno

Agregar en `.env`:
```env
MONGODB_URI=mongodb://mongo:bbl2v9vyemyw2p5g@31.97.133.67:27017/iglesia360bot?authSource=admin&retryWrites=true&w=majority
```

### Cambiar Zona Horaria

Editar en [src/services/billingJobService.js](src/services/billingJobService.js):
```javascript
const closeMonthlyPeriodJob = cron.schedule('1 0 1 * *', async () => {
  await this.closePreviousMonthPeriod();
}, {
  timezone: "America/Lima" // Cambiar aquí
});
```

## 📈 Flujo de Facturación

1. **Durante el mes (1-31)**:
   - Los mensajes se registran automáticamente
   - El periodo está en estado `active`
   - Se puede consultar el uso actual con `/api/billing/current`

2. **Día 1 del mes siguiente (00:01)**:
   - Job automático cierra el periodo anterior
   - Estado cambia de `active` a `closed`
   - Se calcula el monto a pagar

3. **Del día 1 al 5 (ventana de pago)**:
   - Se puede consultar el periodo con `/api/billing/period/:period`
   - Se puede pagar con `/api/billing/pay/:period`
   - Día 3: Se envía recordatorio automático

4. **Después del día 5**:
   - Si no se pagó, el estado cambia a `overdue`
   - Job diario verifica y marca periodos vencidos

5. **Al pagar**:
   - Estado cambia a `paid`
   - Se registra fecha de pago
   - Se pueden agregar notas

## 🚀 Uso

### Enviar Mensaje (se registra automáticamente)
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "51987654321",
    "message": "Hola desde la API"
  }'
```

### Ver Uso Actual
```bash
curl http://localhost:3000/api/billing/current
```

### Ver Mensajes del Mes
```bash
curl http://localhost:3000/api/billing/messages/2026-01
```

### Ver Periodo Específico
```bash
curl http://localhost:3000/api/billing/period/2026-01
```

### Pagar Periodo
```bash
curl -X POST http://localhost:3000/api/billing/pay/2026-01 \
  -H "Content-Type: application/json" \
  -d '{"notes": "Pago confirmado"}'
```

## 📊 Índices de Base de Datos

Para optimizar las consultas, se crean índices automáticamente en:
- `Message.billingPeriod`
- `Message.status`
- `Message.sentAt`
- `BillingPeriod.period` (único)

## 🔍 Monitoreo

Los logs del sistema incluyen:
- Conexión/desconexión de MongoDB
- Ejecución de jobs automáticos
- Registro de mensajes
- Cierres de periodos
- Pagos realizados
- Periodos vencidos

Ver logs en:
- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores
- Consola - Logs en tiempo real

## 🛠️ Troubleshooting

### No se registran mensajes
- Verificar conexión a MongoDB: `/health`
- Revisar logs: `logs/error.log`

### Jobs no se ejecutan
- Verificar que `billingJobService.start()` se llame en `index.js`
- Revisar zona horaria configurada

### Periodos no se cierran automáticamente
- Verificar que el servidor esté corriendo el día 1 del mes
- Revisar logs del job a las 00:01

