#!/bin/bash

# ============================================================================
# Script de Teste - Correção Profile Selection
# ============================================================================

echo "🧪 Iniciando testes de validação do GET /users..."
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base (alterar conforme ambiente)
BASE_URL="http://localhost:3000/api/v1"
TOKEN="seu_token_jwt_aqui"

# Verifica se token foi fornecido
if [ "$TOKEN" == "seu_token_jwt_aqui" ]; then
  echo -e "${YELLOW}⚠️  Aviso: Token JWT não configurado${NC}"
  echo "Configure a variável TOKEN no script ou export TOKEN=seu_token"
  echo ""
fi

# ============================================================================
# Teste 1: Listar todos os usuários (sem filtro)
# ============================================================================
echo -e "${YELLOW}Teste 1: GET /users (sem filtros)${NC}"
curl -s -X GET "$BASE_URL/users?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 1${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 2: Filtrar por empresa
# ============================================================================
echo -e "${YELLOW}Teste 2: GET /users?companyId=29${NC}"
curl -s -X GET "$BASE_URL/users?page=1&limit=5&companyId=29" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 2${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 3: Buscar por nome
# ============================================================================
echo -e "${YELLOW}Teste 3: GET /users?search=maria${NC}"
curl -s -X GET "$BASE_URL/users?page=1&limit=5&search=maria" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 3${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 4: Combinar filtros
# ============================================================================
echo -e "${YELLOW}Teste 4: GET /users?companyId=29&search=joão${NC}"
curl -s -X GET "$BASE_URL/users?page=1&limit=5&companyId=29&search=joão" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 4${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 5: Verificar perfil do usuário atual
# ============================================================================
echo -e "${YELLOW}Teste 5: GET /users/profile (usuário autenticado)${NC}"
curl -s -X GET "$BASE_URL/users/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 5${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 6: Buscar usuário específico
# ============================================================================
echo -e "${YELLOW}Teste 6: GET /users/1 (buscar por ID)${NC}"
curl -s -X GET "$BASE_URL/users/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt" \
  | jq '.' || echo -e "${RED}❌ Erro no teste 6${NC}"
echo ""
echo "---"
echo ""

# ============================================================================
# Teste 7: Verificar estrutura da resposta
# ============================================================================
echo -e "${YELLOW}Teste 7: Verificar campos profileId e profileName${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/users?page=1&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt")

echo "$RESPONSE" | jq '.'

# Verificar se campos existem
HAS_PROFILE_ID=$(echo "$RESPONSE" | jq '.data.users[0].profileId')
HAS_PROFILE_NAME=$(echo "$RESPONSE" | jq '.data.users[0].profileName')

if [ "$HAS_PROFILE_ID" != "null" ]; then
  echo -e "${GREEN}✅ Campo profileId presente${NC}"
else
  echo -e "${YELLOW}⚠️  Campo profileId é null (usuário sem perfil)${NC}"
fi

if [ "$HAS_PROFILE_NAME" != "null" ]; then
  echo -e "${GREEN}✅ Campo profileName presente${NC}"
else
  echo -e "${YELLOW}⚠️  Campo profileName é null (usuário sem perfil)${NC}"
fi

echo ""
echo "---"
echo ""

# ============================================================================
# Teste 8: Estatísticas
# ============================================================================
echo -e "${YELLOW}Teste 8: Estatísticas de usuários com perfil${NC}"
STATS=$(curl -s -X GET "$BASE_URL/users?page=1&limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: pt")

TOTAL=$(echo "$STATS" | jq '.data.pagination.total')
WITH_PROFILE=$(echo "$STATS" | jq '[.data.users[] | select(.profileId != null)] | length')
WITHOUT_PROFILE=$(echo "$STATS" | jq '[.data.users[] | select(.profileId == null)] | length')

echo "Total de usuários: $TOTAL"
echo "Com perfil: $WITH_PROFILE"
echo "Sem perfil: $WITHOUT_PROFILE"
echo ""

# ============================================================================
# Resumo
# ============================================================================
echo "============================================================================"
echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo "============================================================================"
echo ""
echo "📝 Próximos passos:"
echo "  1. Verificar logs do backend (npm run dev)"
echo "  2. Se todos os testes passaram, fazer commit"
echo "  3. Deploy em DEV: npm run deploy:dev"
echo "  4. Testar frontend em DEV"
echo "  5. Deploy em PROD: npm run deploy:prod"
echo ""
echo "🔗 Documentação completa: docs/DEBUG_PROFILE_FIX.md"
echo ""
