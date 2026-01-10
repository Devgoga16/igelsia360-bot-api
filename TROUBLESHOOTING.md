# 🔧 Solución de Problemas - WhatsApp Bot

## Error: "The browser is already running" o "EBUSY: resource busy or locked"

Estos errores indican que hay procesos de Chrome/Chromium bloqueados. **SOLUCIÓN RÁPIDA:**

### ⚡ Solución Rápida (PowerShell)

```powershell
# En PowerShell, ejecuta el script de limpieza
.\clean.ps1
```

Luego inicia el servidor:
```powershell
npm start
```

### Alternativa: Limpieza Manual

```powershell
# 1. Detener el servidor (Ctrl+C si está corriendo)

# 2. Matar todos los procesos de Chrome y Node
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# 3. Esperar 3 segundos
Start-Sleep -Seconds 3

# 4. Eliminar la sesión
Remove-Item -Path ".\.wwebjs_auth" -Recurse -Force -ErrorAction SilentlyContinue

# 5. Iniciar de nuevo
npm start
```

## Error de Puppeteer: "Protocol error (Target.setDiscoverTargets): Target closed"

Este es un error común en Windows con `whatsapp-web.js`. Aquí están las soluciones:

### Solución 1: Script de Limpieza PowerShell (RECOMENDADO)

```powershell
.\clean.ps1
npm start
```

### Solución 2: Usar PM2 (Recomendado para producción)

PM2 reiniciará automáticamente el bot si falla:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar con PM2
npm run pm2:start

# Ver logs en tiempo real
npm run pm2:logs

# Ver estado
npm run pm2:status
```

### Solución 3: Esperar y reintentar

A veces el error es temporal. El bot ahora tiene reintentos automáticos:
- Espera 10 segundos
- El bot intentará reconectar automáticamente
- Verifica los logs para ver el progreso

### Solución 4: Verificar dependencias

```bash
# Reinstalar dependencias
rd /s /q node_modules
del package-lock.json
npm install
```

### Solución 5: Usar modo desarrollo con logs detallados

```bash
npm run dev
```

## Comandos Útiles

```bash
# Iniciar normalmente
npm start

# Modo desarrollo (con auto-reload)
npm run dev

# Limpiar sesión de WhatsApp
npm run clean

# Iniciar con PM2
npm run pm2:start

# Ver logs de PM2
npm run pm2:logs

# Estado de PM2
npm run pm2:status

# Reiniciar con PM2
npm run pm2:restart

# Detener PM2
npm run pm2:stop
```

## Estado del Bot

Una vez que el bot esté corriendo, puedes verificar su estado:

```bash
# En PowerShell o CMD
curl http://localhost:3000/api/status
```

O abre en tu navegador: http://localhost:3000/api/status

## Ver el Código QR

Si el bot está esperando el QR, abre en tu navegador:

http://localhost:3000/api/qr-image

## Logs

Los logs se guardan en la carpeta `logs/`:
- `error.log` - Solo errores
- `combined.log` - Todo
- `pm2-error.log` - Errores de PM2 (si usas PM2)
- `pm2-out.log` - Output de PM2 (si usas PM2)

## Notas Importantes

1. **El error de Puppeteer es temporal**: El bot ahora tiene reintentos automáticos. Déjalo correr por 30-60 segundos.

2. **Primera ejecución**: La primera vez tarda más porque descarga Chromium (~150MB).

3. **Windows Defender**: Si Windows Defender bloquea Chromium, agrega una excepción.

4. **Firewall**: Asegúrate de que Node.js tenga permisos en el firewall.

5. **Paciencia**: La inicialización puede tardar 1-2 minutos la primera vez.

## Estado Esperado

Después de iniciar, deberías ver algo como:

```
2026-01-09 12:00:00 [INFO]: Inicializando cliente de WhatsApp...
2026-01-09 12:00:05 [INFO]: Código QR generado
2026-01-09 12:00:05 [INFO]: Código QR convertido a base64 y almacenado
```

Luego abre http://localhost:3000/api/qr-image y escanea el código.

## Si nada funciona

1. Reinicia tu computadora
2. Asegúrate de tener Node.js 16 o superior: `node --version`
3. Verifica que no tengas otro bot de WhatsApp corriendo
4. Revisa los logs en `logs/combined.log`
5. Contacta al equipo de soporte con los logs
