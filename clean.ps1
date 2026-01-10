# Script para limpiar y reiniciar el bot de WhatsApp
Write-Host "=== Limpieza del Bot de WhatsApp ===" -ForegroundColor Cyan

# Matar procesos de Node.js
Write-Host "Matando procesos de Node.js..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Matar procesos de Chrome/Chromium
Write-Host "Matando procesos de Chrome/Chromium..." -ForegroundColor Yellow
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Esperar un momento para que se liberen los recursos
Write-Host "Esperando liberacion de recursos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Eliminar carpeta de sesion si existe
$sessionPath = ".\.wwebjs_auth"
if (Test-Path $sessionPath) {
    Write-Host "Eliminando datos de sesion..." -ForegroundColor Yellow
    Remove-Item -Path $sessionPath -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    if (Test-Path $sessionPath) {
        Write-Host "No se pudo eliminar completamente. Intentando de nuevo..." -ForegroundColor Red
        Start-Sleep -Seconds 2
        Remove-Item -Path $sessionPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    if (Test-Path $sessionPath) {
        Write-Host "ERROR: No se pudo eliminar la sesion. Cierra manualmente todos los procesos." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Sesion eliminada correctamente" -ForegroundColor Green
    }
} else {
    Write-Host "No hay sesion previa para limpiar" -ForegroundColor Gray
}

# Eliminar carpeta de cache si existe
$cachePath = ".\.wwebjs_cache"
if (Test-Path $cachePath) {
    Write-Host "Eliminando cache..." -ForegroundColor Yellow
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cache eliminado" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Limpieza completada ===" -ForegroundColor Green
Write-Host "Ahora puedes ejecutar: npm start" -ForegroundColor Cyan
Write-Host ""
