# ============================================================================

# POLO X - Guia de Deploy Docker

# ============================================================================

## 📋 Pré-requisitos

- Docker instalado
- Docker Compose instalado
- Traefik rodando na rede `traefik-public`
- PostgreSQL rodando no host (porta 5434)

## 🏠 Desenvolvimento Local (sem Docker)

```bash
npm run dev:local
```

## 🐳 Desenvolvimento Local (com Docker)

```bash
# Iniciar container
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar container
docker-compose down
```

## 🚀 Deploy em Produção

### Opção 1: Script Automático

```bash
chmod +x deploy-prod.sh
./deploy-prod.sh
```

### Opção 2: Manual

```bash
# 1. Build da imagem
docker build -t polox-api:latest .

# 2. Subir container
docker-compose -f docker-compose.prod.yml up -d

# 3. Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Opção 3: Makefile

```bash
# Build
make build-image

# Deploy
make deploy-prod

# Logs
make logs

# Status
make status
```

## 📝 Configuração do Traefik

O Traefik já está configurado no `docker-compose.prod.yml` com:

- ✅ **HTTPS automático** via Let's Encrypt
- ✅ **Health check** da aplicação
- ✅ **CORS** configurado
- ✅ **Load balancer**

### Domínio Configurado

```
https://api.polox.com.br
```

Certifique-se de:

1. DNS apontando para o servidor
2. Traefik rodando na rede `traefik-public`
3. Porta 443 aberta no firewall

## 🔧 Comandos Úteis

### Ver logs em tempo real

```bash
docker logs -f polox-api-prod
```

### Acessar shell do container

```bash
docker exec -it polox-api-prod sh
```

### Rodar migrations

```bash
docker exec polox-api-prod node migrations/migration-runner.js up
```

### Restart do container

```bash
docker restart polox-api-prod
```

### Ver status

```bash
docker ps | grep polox-api
```

### Health check manual

```bash
curl http://localhost:3000/health
# ou
curl https://api.polox.com.br/health
```

## 🌐 Endpoints

Após deploy:

- **API Root**: https://api.polox.com.br/
- **Health Check**: https://api.polox.com.br/health
- **Swagger**: https://api.polox.com.br/api/v1/docs
- **Contacts**: https://api.polox.com.br/api/v1/contacts

## 🔐 Variáveis de Ambiente

Crie `.env.production` na raiz do projeto:

```env
NODE_ENV=production
PORT=3000

# Database (PostgreSQL no host)
DB_HOST=172.17.0.1
DB_PORT=5434
DB_NAME=app_polox_prod
DB_USER=admin
DB_PASSWORD=PoloxHjdfhrhcvfBCSsgdo2x12

# JWT
JWT_SECRET=prod-jwt-secret-super-seguro-2025-polox-crm
JWT_REFRESH_SECRET=prod-refresh-secret-super-seguro-2025-polox-crm

# Swagger
ENABLE_SWAGGER=true

# Timezone
TZ=America/Sao_Paulo
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs
docker logs polox-api-prod

# Verificar configuração
docker inspect polox-api-prod
```

### Não conecta no banco

Verifique:

1. PostgreSQL rodando na porta 5434
2. Firewall permite conexão do Docker
3. DB_HOST correto (172.17.0.1 no Linux, host.docker.internal no Mac/Windows)

### Traefik não roteia

```bash
# Ver logs do Traefik
docker logs traefik

# Verificar rede
docker network inspect traefik-public

# Verificar labels
docker inspect polox-api-prod | grep -A 20 Labels
```

### Health check falha

```bash
# Testar dentro do container
docker exec polox-api-prod curl http://localhost:3000/health

# Ver logs da aplicação
docker logs polox-api-prod | grep health
```

## 📊 Monitoramento

### Logs

```bash
# Últimas 100 linhas
docker logs --tail 100 polox-api-prod

# Tempo real
docker logs -f polox-api-prod

# Desde timestamp
docker logs --since 2024-01-01T00:00:00 polox-api-prod
```

### Estatísticas

```bash
# CPU e memória em tempo real
docker stats polox-api-prod

# Informações do container
docker inspect polox-api-prod
```

## 🔄 Atualização

Para atualizar a aplicação:

```bash
# Método 1: Script
./deploy-prod.sh

# Método 2: Manual
docker build -t polox-api:latest .
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## 🧹 Limpeza

```bash
# Remover container
docker-compose -f docker-compose.prod.yml down

# Remover volumes
docker-compose -f docker-compose.prod.yml down -v

# Limpar imagens antigas
docker image prune -a

# Limpar tudo
docker system prune -a --volumes
```

## 📦 Backup

### Logs

```bash
docker logs polox-api-prod > backup-logs-$(date +%Y%m%d).log
```

### Volumes

```bash
docker run --rm -v polox-api-prod_api-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz /data
```

## 🚨 Rollback

Se algo der errado:

```bash
# 1. Parar container atual
docker-compose -f docker-compose.prod.yml down

# 2. Usar imagem de backup
docker tag polox-api:backup-YYYYMMDD-HHMMSS polox-api:latest

# 3. Subir novamente
docker-compose -f docker-compose.prod.yml up -d
```
