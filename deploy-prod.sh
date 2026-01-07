#!/bin/bash
# ============================================================================
# POLO X - Script de Deploy em Produção (Ubuntu Server)
# ============================================================================
# Uso: ./deploy-prod.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy da API Polox..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto${NC}"
    exit 1
fi

# Verificar se .env.production existe
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Erro: Arquivo .env.production não encontrado!${NC}"
    echo -e "${YELLOW}💡 Copie .env.production.example para .env.production e configure${NC}"
    exit 1
fi

# 1. BUILD DA IMAGEM
echo -e "\n${YELLOW}📦 Construindo imagem Docker...${NC}"
docker-compose -f docker-compose.prod.yml build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao construir imagem${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Imagem construída com sucesso${NC}"

# 2. PARAR CONTAINER ANTIGO (se existir)
if [ "$(docker ps -q -f name=polox-api-prod)" ]; then
    echo -e "\n${YELLOW}🔄 Parando container antigo...${NC}"
    docker-compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✅ Container antigo removido${NC}"
fi

# 3. INICIAR NOVO CONTAINER
echo -e "\n${YELLOW}🚀 Iniciando novo container...${NC}"
docker-compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao iniciar container${NC}"
    exit 1
fi

# 4. AGUARDAR HEALTH CHECK
echo -e "\n${YELLOW}⏳ Aguardando health check (40s)...${NC}"
sleep 10

# Verificar se container está rodando
if [ ! "$(docker ps -q -f name=polox-api-prod)" ]; then
    echo -e "${RED}❌ Container não está rodando!${NC}"
    echo -e "\n${YELLOW}📋 Logs do container:${NC}"
    docker logs polox-api-prod
    exit 1
fi

# 5. VERIFICAR HEALTH
echo -e "\n${YELLOW}🏥 Verificando health check...${NC}"
sleep 30
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' polox-api-prod 2>/dev/null || echo "no healthcheck")
echo -e "   Status: ${HEALTH}"

# 6. VERIFICAR LOGS
echo -e "\n${YELLOW}📋 Últimas linhas do log:${NC}"
docker logs --tail 20 polox-api-prod

# 7. STATUS FINAL
echo -e "\n${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo -e "\n📊 Status do container:"
docker ps | grep polox-api-prod || echo "Container não encontrado"

echo -e "\n🌐 API disponível em:"
echo -e "   - https://api.polox.com.br"
echo -e "   - Health: https://api.polox.com.br/health"
echo -e "   - Swagger: https://api.polox.com.br/api/v1/docs"

echo -e "\n📝 Comandos úteis:"
echo -e "   - Ver logs:        docker logs -f polox-api-prod"
echo -e "   - Restart:         docker restart polox-api-prod"
echo -e "   - Shell:           docker exec -it polox-api-prod sh"
echo -e "   - Parar:           docker-compose -f docker-compose.prod.yml down"
echo -e "   - Rodar migrations: docker exec polox-api-prod node migrations/migration-runner.js up"

echo -e "\n✅ Deploy finalizado!"
