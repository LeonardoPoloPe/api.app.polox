#!/bin/bash

# ============================================================================
# POLO X - Test Script: User Profile Menu Endpoint
# ============================================================================
# Script para testar o endpoint GET /users/:id/profile-menu
# Testa a funcionalidade de busca de perfil e menus do usuário
# ============================================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
BASE_URL="${API_URL:-https://api.poloxapp.com.br/api/v1}"
TOKEN="${API_TOKEN:-}"

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        TESTE: GET /users/profile-menu                        ║"
echo "║        Endpoint de Perfil e Menus do Usuário Autenticado    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se o token foi fornecido
if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Erro: Token de autenticação não fornecido${NC}"
    echo -e "${YELLOW}Use: export API_TOKEN='seu_token_jwt'${NC}"
    echo -e "${YELLOW}Ou: ./test-user-profile-menu.sh seu_token_jwt${NC}"
    exit 1
fi

# Se token foi passado como argumento
if [ -n "$1" ]; then
    TOKEN="$1"
fi

echo -e "${BLUE}📝 Configurações:${NC}"
echo "   - Base URL: $BASE_URL"
echo "   - Autenticação: Via Token JWT"
echo "   - Token: ${TOKEN:0:20}..."
echo ""
echo -e "${GREEN}🔒 Segurança: Endpoint usa automaticamente o usuário do token${NC}"
echo ""

# Função para fazer requisição
make_request() {
    local lang=$1
    local lang_name=$2
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}🌐 Testando idioma: ${lang_name} (${lang})${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    local response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Accept-Language: ${lang}" \
        -H "Content-Type: application/json" \
        "${BASE_URL}/users/profile-menu")
    
    local http_body=$(echo "$response" | sed -e 's/HTTP_STATUS\:.*//g')
    local http_status=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
    
    echo -e "\n${BLUE}📊 Status HTTP: ${http_status}${NC}"
    
    if [ "$http_status" -eq 200 ]; then
        echo -e "${GREEN}✅ Sucesso!${NC}\n"
        echo "$http_body" | jq '.'
        
        # Extrair informações chave
        echo -e "\n${BLUE}📋 Resumo da Resposta:${NC}"
        
        local user_name=$(echo "$http_body" | jq -r '.data.user.fullName // "N/A"')
        local user_email=$(echo "$http_body" | jq -r '.data.user.email // "N/A"')
        local user_role=$(echo "$http_body" | jq -r '.data.user.role // "N/A"')
        local profile_name=$(echo "$http_body" | jq -r '.data.user.profileName // "N/A"')
        local menu_count=$(echo "$http_body" | jq -r '.data.menus | length // 0')
        
        echo "   👤 Usuário: $user_name ($user_email)"
        echo "   🎭 Role: $user_role"
        echo "   📋 Perfil: $profile_name"
        echo "   📂 Total de Menus (Root): $menu_count"
        
        # Listar menus principais
        if [ "$menu_count" -gt 0 ]; then
            echo -e "\n${BLUE}📂 Menus Principais:${NC}"
            echo "$http_body" | jq -r '.data.menus[] | "   • \(.label) (\(.route // "no-route")) - ID: \(.id)"'
            
            # Contar total de menus incluindo filhos
            local total_menus=$(echo "$http_body" | jq '[.data.menus | .. | objects | select(has("id"))] | length')
            echo -e "\n   ${GREEN}Total de menus (incluindo submenus): $total_menus${NC}"
        fi
        
    elif [ "$http_status" -eq 401 ]; then
        echo -e "${RED}❌ Erro de Autenticação!${NC}"
        echo "$http_body" | jq '.'
        
    elif [ "$http_status" -eq 404 ]; then
        echo -e "${YELLOW}⚠️  Usuário não encontrado!${NC}"
        echo "$http_body" | jq '.'
        
    else
        echo -e "${RED}❌ Erro na requisição!${NC}"
        echo "$http_body" | jq '.'
    fi
    
    echo ""
}

# Testar nos 3 idiomas
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        Iniciando testes em múltiplos idiomas                 ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

make_request "pt-BR" "Português"
make_request "en-US" "English"
make_request "es-ES" "Español"

# Teste adicional: Token inválido
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 Testando token inválido${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer token_invalido_123" \
    -H "Accept-Language: pt-BR" \
    -H "Content-Type: application/json" \
    "${BASE_URL}/users/profile-menu")

http_body=$(echo "$response" | sed -e 's/HTTP_STATUS\:.*//g')
http_status=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo -e "\n${BLUE}📊 Status HTTP: ${http_status}${NC}"

if [ "$http_status" -eq 401 ]; then
    echo -e "${GREEN}✅ Comportamento esperado (401 - Unauthorized)!${NC}\n"
    echo "$http_body" | jq '.'
else
    echo -e "${RED}❌ Status inesperado!${NC}\n"
    echo "$http_body" | jq '.'
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        Testes concluídos!                                    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Instruções de uso
echo -e "${YELLOW}💡 Dicas de uso:${NC}"
echo "   1. Uso básico (com variável de ambiente):"
echo "      export API_TOKEN='seu_token_jwt'"
echo "      ./test-user-profile-menu.sh"
echo ""
echo "   2. Uso direto (passando token como argumento):"
echo "      ./test-user-profile-menu.sh \$TOKEN"
echo ""
echo "   3. Para testar com URL diferente:"
echo "      API_URL=http://localhost:3000/api/v1 ./test-user-profile-menu.sh \$TOKEN"
echo ""
echo "   4. 🔒 Segurança:"
echo "      - O endpoint usa automaticamente o ID do usuário do token JWT"
echo "      - Não é possível acessar dados de outros usuários"
echo "      - Cada usuário só vê seu próprio perfil e menus"
echo ""
echo "   5. Formato de resposta esperado:"
echo "      {
        success: true,
        message: 'Perfil e menus carregados com sucesso',
        data: {
          user: { id, fullName, email, role, ... },
          profile: { id, name, translations, screenIds },
          menus: [ { id, label, icon, route, children: [...] } ]
        }
      }"
echo ""
