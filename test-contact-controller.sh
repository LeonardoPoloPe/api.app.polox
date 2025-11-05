#!/bin/bash

# ==========================================
# 🧪 TESTES MANUAIS - CONTACT CONTROLLER
# ==========================================
# Script para testar todos os endpoints do ContactController via curl
# 
# Uso: bash test-contact-controller.sh

set -e

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
BASE_URL="http://localhost:3000/api/v1"
TOKEN=""

# Função para imprimir cabeçalhos
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Função para imprimir sucesso
print_success() {
    echo -e "${GREEN}✅ $1${NC}\n"
}

# Função para imprimir erro
print_error() {
    echo -e "${RED}❌ $1${NC}\n"
}

# Função para imprimir aviso
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}\n"
}

# Função para fazer requisição e mostrar resultado
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_status=$5  # Status esperado (opcional)
    
    echo -e "${YELLOW}Testando: ${description}${NC}"
    echo -e "Método: ${method}"
    echo -e "Endpoint: ${BASE_URL}${endpoint}"
    
    if [ -n "$data" ]; then
        echo -e "Dados: ${data}\n"
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Accept-Language: pt" \
            -H "Content-Type: application/json" \
            -d "${data}")
    else
        echo ""
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Accept-Language: pt")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo -e "Status: ${http_code}"
    echo -e "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    # Se foi especificado um status esperado, verificar se corresponde
    if [ -n "$expected_status" ]; then
        if [ "$http_code" = "$expected_status" ]; then
            print_success "Sucesso! (Status ${http_code} esperado)"
        else
            print_error "Falhou! Esperado ${expected_status}, recebido ${http_code}"
        fi
    else
        # Comportamento padrão: 2xx é sucesso
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            print_success "Sucesso!"
        else
            print_error "Falhou com status ${http_code}"
        fi
    fi
    
    echo -e "${BLUE}----------------------------------------${NC}\n"
    sleep 1
}

# ==========================================
# PASSO 1: LOGIN
# ==========================================
print_header "PASSO 1: LOGIN"

echo "Fazendo login para obter token..."
login_response=$(curl -s -X POST \
    "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -H "Accept-Language: pt" \
    -d '{
        "email": "polo@polox.com.br",
        "password": "M@eamor1122",
        "rememberMe": false
    }')

TOKEN=$(echo "$login_response" | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    print_error "Falha no login! Verifique as credenciais."
    echo "$login_response" | jq '.'
    exit 1
fi

print_success "Login realizado com sucesso!"
echo "Token: ${TOKEN:0:50}..."

# ==========================================
# PASSO 2: CRIAR CONTATO
# ==========================================
print_header "PASSO 2: POST /contacts - Criar Contato"

UNIQUE_PHONE="5511$(date +%s)"
UNIQUE_EMAIL="teste$(date +%s)@exemplo.com"

make_request "POST" "/contacts" \
'{
    "nome": "João Teste Curl",
    "phone": "'"${UNIQUE_PHONE}"'",
    "email": "'"${UNIQUE_EMAIL}"'",
    "tipo": "lead",
    "origem": "teste_curl"
}' \
"Criar novo contato"

# Extrair ID do contato criado
CONTACT_ID=$(curl -s -X GET \
    "${BASE_URL}/contacts/search?phone=${UNIQUE_PHONE}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept-Language: pt" | jq -r '.data.id')

if [ -z "$CONTACT_ID" ] || [ "$CONTACT_ID" = "null" ]; then
    print_error "Não foi possível obter o ID do contato criado"
    exit 1
fi

print_success "Contato criado com ID: ${CONTACT_ID}"

# ==========================================
# PASSO 3: LISTAR CONTATOS
# ==========================================
print_header "PASSO 3: GET /contacts - Listar Contatos"

make_request "GET" "/contacts?limit=5&offset=0" "" \
"Listar contatos com paginação"

# ==========================================
# PASSO 4: BUSCAR CONTATO POR ID
# ==========================================
print_header "PASSO 4: GET /contacts/:id - Buscar por ID"

make_request "GET" "/contacts/${CONTACT_ID}" "" \
"Buscar contato por ID"

# ==========================================
# PASSO 5: BUSCAR POR TELEFONE
# ==========================================
print_header "PASSO 5: GET /contacts/search - Buscar por Telefone"

make_request "GET" "/contacts/search?phone=${UNIQUE_PHONE}" "" \
"Buscar contato por telefone"

# ==========================================
# PASSO 6: BUSCAR POR EMAIL
# ==========================================
print_header "PASSO 6: GET /contacts/search - Buscar por Email"

make_request "GET" "/contacts/search?email=${UNIQUE_EMAIL}" "" \
"Buscar contato por email"

# ==========================================
# PASSO 7: BUSCAR INEXISTENTE
# ==========================================
print_header "PASSO 7: GET /contacts/search - Buscar Inexistente"

make_request "GET" "/contacts/search?phone=5511000000000" "" \
"Buscar contato inexistente (deve retornar found=false)"

# ==========================================
# PASSO 8: ATUALIZAR CONTATO
# ==========================================
print_header "PASSO 8: PUT /contacts/:id - Atualizar Contato"

make_request "PUT" "/contacts/${CONTACT_ID}" \
'{
    "nome": "João Teste Curl Atualizado",
    "origem": "teste_curl_atualizado"
}' \
"Atualizar nome e origem do contato"

# ==========================================
# PASSO 9: FILTRAR POR TIPO
# ==========================================
print_header "PASSO 9: GET /contacts?tipo=lead - Filtrar por Tipo"

make_request "GET" "/contacts?tipo=lead&limit=5" "" \
"Filtrar apenas leads"

# ==========================================
# PASSO 10: BUSCAR COM TEXTO
# ==========================================
print_header "PASSO 10: GET /contacts?search=João - Buscar por Texto"

# URL encode: João = Jo%C3%A3o
make_request "GET" "/contacts?search=Jo%C3%A3o&limit=5" "" \
"Buscar contatos com nome João"

# ==========================================
# PASSO 11: GET-OR-CREATE (EXISTENTE)
# ==========================================
print_header "PASSO 11: POST /contacts/get-or-create - Contato Existente"

make_request "POST" "/contacts/get-or-create" \
'{
    "phone": "'"${UNIQUE_PHONE}"'",
    "nome": "João Teste"
}' \
"Get-or-Create com contato existente"

# ==========================================
# PASSO 12: GET-OR-CREATE (NOVO)
# ==========================================
print_header "PASSO 12: POST /contacts/get-or-create - Criar Novo"

NEW_PHONE="5511$(date +%s)"

make_request "POST" "/contacts/get-or-create" \
'{
    "phone": "'"${NEW_PHONE}"'",
    "email": "novo'"$(date +%s)"'@teste.com",
    "nome": "Novo Contato via Get-or-Create"
}' \
"Get-or-Create criando novo contato"

# ==========================================
# PASSO 13: GET-OR-CREATE COM NEGOCIAÇÃO
# ==========================================
print_header "PASSO 13: POST /contacts/get-or-create-with-negotiation"

DEAL_PHONE="5511$(date +%s)"

make_request "POST" "/contacts/get-or-create-with-negotiation" \
'{
    "phone": "'"${DEAL_PHONE}"'",
    "email": "deal'"$(date +%s)"'@teste.com",
    "nome": "Contato com Negociação",
    "origem_lp": "Landing Page Teste",
    "valor_estimado": 150000,
    "deal_title": "Negociação Teste Curl",
    "deal_stage": "novo"
}' \
"Criar contato e negociação juntos"

# ==========================================
# PASSO 14: SEGUNDA NEGOCIAÇÃO PARA MESMO CONTATO
# ==========================================
print_header "PASSO 14: POST /contacts/get-or-create-with-negotiation - Segunda Deal"

make_request "POST" "/contacts/get-or-create-with-negotiation" \
'{
    "phone": "'"${DEAL_PHONE}"'",
    "nome": "Contato com Negociação",
    "origem_lp": "Segunda Oportunidade",
    "valor_estimado": 250000,
    "deal_title": "Segunda Negociação"
}' \
"Criar segunda negociação para o mesmo contato"

# ==========================================
# PASSO 15: ESTATÍSTICAS
# ==========================================
print_header "PASSO 15: GET /contacts/stats - Estatísticas"

make_request "GET" "/contacts/stats" "" \
"Obter estatísticas de contatos"

# ==========================================
# PASSO 16: CONVERTER LEAD EM CLIENTE
# ==========================================
print_header "PASSO 16: POST /contacts/:id/convert - Converter para Cliente"

make_request "POST" "/contacts/${CONTACT_ID}/convert" "" \
"Converter lead em cliente"

# ==========================================
# PASSO 17: VERIFICAR CONVERSÃO
# ==========================================
print_header "PASSO 17: GET /contacts/:id - Verificar Conversão"

make_request "GET" "/contacts/${CONTACT_ID}" "" \
"Verificar se contato foi convertido para cliente"

# ==========================================
# PASSO 18: TENTAR CONVERTER NOVAMENTE (DEVE FALHAR)
# ==========================================
print_header "PASSO 18: POST /contacts/:id/convert - Tentar Converter Novamente"

make_request "POST" "/contacts/${CONTACT_ID}/convert" "" \
"Tentar converter cliente novamente (deve falhar)" "400"

# ==========================================
# PASSO 19: EXCLUIR CONTATO (SOFT DELETE)
# ==========================================
print_header "PASSO 19: DELETE /contacts/:id - Soft Delete"

make_request "DELETE" "/contacts/${CONTACT_ID}" "" \
"Excluir contato (soft delete)"

# ==========================================
# PASSO 20: VERIFICAR SE FOI DELETADO
# ==========================================
print_header "PASSO 20: GET /contacts/:id - Verificar Soft Delete"

make_request "GET" "/contacts/${CONTACT_ID}" "" \
"Tentar buscar contato deletado (deve retornar 404)" "404"

# ==========================================
# PASSO 21: TESTES DE VALIDAÇÃO
# ==========================================
print_header "PASSO 21: POST /contacts - Validação sem Nome"

make_request "POST" "/contacts" \
'{
    "phone": "5511888888888",
    "email": "sem.nome@teste.com"
}' \
"Tentar criar contato sem nome (deve falhar)" "400"

# ==========================================
print_header "PASSO 22: POST /contacts - Validação sem Identificador"

make_request "POST" "/contacts" \
'{
    "nome": "Teste Sem Identificador"
}' \
"Tentar criar contato sem phone/email/document (deve falhar)" "400"

# ==========================================
print_header "PASSO 23: GET /contacts/search - Sem Parâmetros"

make_request "GET" "/contacts/search" "" \
"Buscar sem parâmetros (deve falhar)" "400"

# ==========================================
# RESUMO FINAL
# ==========================================
print_header "RESUMO DOS TESTES"

echo -e "${GREEN}✅ Testes concluídos!${NC}\n"
echo "Endpoints testados:"
echo "  ✓ POST   /api/v1/auth/login"
echo "  ✓ POST   /api/v1/contacts"
echo "  ✓ GET    /api/v1/contacts"
echo "  ✓ GET    /api/v1/contacts/:id"
echo "  ✓ GET    /api/v1/contacts/search"
echo "  ✓ PUT    /api/v1/contacts/:id"
echo "  ✓ POST   /api/v1/contacts/get-or-create"
echo "  ✓ POST   /api/v1/contacts/get-or-create-with-negotiation"
echo "  ✓ POST   /api/v1/contacts/:id/convert"
echo "  ✓ GET    /api/v1/contacts/stats"
echo "  ✓ DELETE /api/v1/contacts/:id"
echo ""
echo -e "${BLUE}Verifique os resultados acima para validar cada endpoint.${NC}"
echo -e "${YELLOW}Contatos de teste criados podem ser limpos manualmente.${NC}\n"
