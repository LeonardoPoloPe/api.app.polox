#!/bin/bash
# ============================================================================
# POLO X - Atualizar Container de PRODUÇÃO
# ============================================================================
# Uso: ./atualizar-prod.sh

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🚀 Atualizando Container PRODUÇÃO                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Entrar na pasta
cd ~/api-polox
echo -e "${YELLOW}📁 Pasta: $(pwd)${NC}"
echo ""

# 2. Git pull
echo -e "${YELLOW}📥 Baixando código atualizado...${NC}"
git pull
echo -e "${GREEN}✅ Código atualizado${NC}"
echo ""

# 3. Build da imagem
echo -e "${YELLOW}🔨 Construindo imagem Docker...${NC}"
docker compose -f docker-compose.prod.yml build
echo -e "${GREEN}✅ Imagem construída${NC}"
echo ""

# 4. Reiniciar container
echo -e "${YELLOW}🔄 Reiniciando container...${NC}"
docker compose -f docker-compose.prod.yml up -d
sleep 5
echo -e "${GREEN}✅ Container reiniciado${NC}"
echo ""

# 5. Status
echo -e "${BLUE}📊 Status do container:${NC}"
docker ps | grep polox-api-prod
echo ""

# 6. Logs
echo -e "${BLUE}📋 Últimas 30 linhas do log:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
docker logs --tail 30 polox-api-prod
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 7. Teste de health
echo -e "${BLUE}🏥 Testando health check...${NC}"
sleep 3
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' polox-api-prod 2>/dev/null || echo "no healthcheck")
echo -e "   Status: ${GREEN}${HEALTH}${NC}"
echo ""

# 8. Teste de acesso
echo -e "${BLUE}🌐 Testando acesso à API...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ API respondendo (HTTP $HTTP_CODE)${NC}"
else
    echo -e "   ${RED}❌ API não respondeu (HTTP $HTTP_CODE)${NC}"
fi
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Atualização de PRODUÇÃO concluída!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌍 URL: https://api.polox.com.br${NC}"
echo -e "${BLUE}📚 Docs: https://api.polox.com.br/api/v1/docs${NC}"
echo -e "${BLUE}🏥 Health: https://api.polox.com.br/health${NC}"
echo ""
echo -e "${YELLOW}💡 Para ver logs em tempo real:${NC}"
echo -e "   ${GREEN}docker logs -f polox-api-prod${NC}"
echo ""
