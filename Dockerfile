# Imagen base de Node.js 18 con Alpine para tamaño optimizado
FROM node:18-bullseye-slim

# Metadatos
LABEL maintainer="Iglesia360"
LABEL description="WhatsApp Bot API con persistencia y auto-recuperación"

# Variables de entorno
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Instalar dependencias del sistema necesarias para Puppeteer y Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome Stable
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production && npm cache clean --force

# Copiar el código fuente
COPY . .

# Crear directorios necesarios con permisos adecuados
RUN mkdir -p /app/.wwebjs_auth /app/.wwebjs_cache /app/logs \
    && chmod -R 777 /app/.wwebjs_auth /app/.wwebjs_cache /app/logs

# Crear usuario no-root para seguridad y su directorio home
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && mkdir -p /home/botuser/.local/share/applications \
    && mkdir -p /home/botuser/.config \
    && chown -R botuser:botuser /app /home/botuser

# Cambiar a usuario no-root
USER botuser

# Variables de entorno para Chrome/Puppeteer
ENV HOME=/home/botuser
ENV XDG_CONFIG_HOME=/home/botuser/.config
ENV XDG_CACHE_HOME=/home/botuser/.cache

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "src/index.js"]
