#!/bin/bash
# ============================================================================
# POLO X - Script de Deploy Multi-Ambientes
# ============================================================================
# Uso: ./deploy-multi.sh [prod|dev|hml] [build|up|down|restart|logs|status]

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função de ajuda
show_help() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       POLO X - Deploy Multi-Ambientes                   ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Uso: ./deploy-multi.sh [ambiente] [ação]"
    echo ""
    echo "Ambientes:"
    echo "  prod    → api.polox.com.br (app_polox_prod)"
    echo "  dev     → api-dev.polox.com.br (app_polox_dev)"
    echo "  hml     → api-hml.polox.com.br (app_polox_sandbox)"
    echo ""
    echo "Ações:"
    echo "  build   → Construir imagem Docker"
    echo "  up      → Subir container"
    echo "  down    → Parar e remover container"
    echo "  restart → Reiniciar container"
    echo "  logs    → Ver logs em tempo real"
    echo "  status  → Status do container"
    echo ""
    echo "Exemplos:"
    echo "  ./deploy-multi.sh prod build    # Build produção"
    echo "  ./deploy-multi.sh dev up        # Subir dev"
    echo "  ./deploy-multi.sh hml logs      # Ver logs hml"
    echo "  ./deploy-multi.sh prod restart  # Restart prod"
    echo ""
}

# Verificar argumentos
if [ "$#" -lt 2 ]; then
    show_help
    exit 1
fi

ENV=$1
ACTION=$2

# Validar ambiente
case $ENV in
    prod)
        COMPOSE_FILE="docker-compose.prod.yml"
        CONTAINER_NAME="polox-api-prod"
        ENV_FILE=".env.production"
        URL="api.polox.com.br"
        ;;
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        CONTAINER_NAME="polox-api-dev"
        ENV_FILE=".env.dev"
        URL="api-dev.polox.com.br"
        ;;
    hml)
        COMPOSE_FILE="docker-compose.hml.yml"
        CONTAINER_NAME="polox-api-hml"
        ENV_FILE=".env.hml"
        URL="api-hml.polox.com.br"
        ;;
    *)
        echo -e "${RED}❌ Ambiente inválido: $ENV${NC}"
        echo -e "${YELLOW}Use: prod, dev ou hml${NC}"
        exit 1
        ;;
esac

# Verificar se arquivo .env existe
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Arquivo $ENV_FILE não encontrado!${NC}"
    exit 1
fi

# Executar ação
case $ACTION in
    build)
        echo -e "${YELLOW}🔨 Construindo imagem para ${ENV}...${NC}"
        docker compose -f $COMPOSE_FILE build
        echo -e "${GREEN}✅ Build concluído${NC}"
        ;;
        
    up)
        echo -e "${YELLOW}🚀 Subindo container ${ENV}...${NC}"
        docker compose -f $COMPOSE_FILE up -d
        sleep 5
        echo -e "${GREEN}✅ Container iniciado${NC}"
        echo -e "${BLUE}🌐 URL: https://${URL}${NC}"
        docker ps | grep $CONTAINER_NAME
        ;;
        
    down)
        echo -e "${YELLOW}🛑 Parando container ${ENV}...${NC}"
        docker compose -f $COMPOSE_FILE down
        echo -e "${GREEN}✅ Container parado e removido${NC}"
        ;;
        
    restart)
        echo -e "${YELLOW}🔄 Reiniciando container ${ENV}...${NC}"
        docker restart $CONTAINER_NAME
        sleep 3
        echo -e "${GREEN}✅ Container reiniciado${NC}"
        docker ps | grep $CONTAINER_NAME
        ;;
        
    logs)
        echo -e "${BLUE}📋 Logs de ${ENV} (Ctrl+C para sair)...${NC}"
        docker logs -f $CONTAINER_NAME
        ;;
        
    status)
        echo -e "${BLUE}📊 Status de ${ENV}:${NC}"
        docker ps | grep $CONTAINER_NAME || echo -e "${RED}❌ Container não está rodando${NC}"
        echo ""
        echo -e "${BLUE}Health:${NC}"
        docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "N/A"
        echo ""
        echo -e "${BLUE}Últimas 10 linhas do log:${NC}"
        docker logs --tail 10 $CONTAINER_NAME
        ;;
        
    *)
        echo -e "${RED}❌ Ação inválida: $ACTION${NC}"
        show_help
        exit 1
        ;;
esac
