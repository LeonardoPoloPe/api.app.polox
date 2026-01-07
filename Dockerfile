# ============================================================================
# POLO X - API Dockerfile
# ============================================================================
# Multi-stage build para otimizar tamanho da imagem

# Stage 1: Build
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Instalar dependências (incluindo devDependencies para build)
RUN npm install -g pnpm@latest && \
    pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Stage 2: Production
FROM node:22.14.0-alpine

# Instalar curl e bash (necessários para health check e scripts)
RUN apk add --no-cache curl bash

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Copiar scripts ANTES do install (necessário para postinstall)
COPY scripts ./scripts

# Instalar apenas dependências de produção (ignorando scripts postinstall)
RUN npm install -g pnpm@latest && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Copiar código da aplicação do builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Criar diretórios para logs e uploads
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Comando para iniciar aplicação
CMD ["node", "src/server.js"]
