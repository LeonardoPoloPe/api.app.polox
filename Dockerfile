# ============================================================================
# POLO X - API Dockerfile
# ============================================================================
# Single-stage build simplificado (JavaScript puro, sem transpilação)

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

# Instalar apenas dependências de produção (ignorando scripts postinstall)
RUN npm install -g pnpm@latest && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Copiar código da aplicação
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs migrations ./migrations
COPY --chown=nodejs:nodejs scripts ./scripts

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
