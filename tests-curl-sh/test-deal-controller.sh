#!/bin/bash

# ==========================================
# 🧪 TESTES MANUAIS - DEAL CONTROLLER
# ==========================================
# Script para testar todos os endpoints do DealController via curl
# Pipeline de Vendas (Negociações)
# 
# Uso: bash test-deal-controller.sh

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
CONTACT_ID="41"  # ID do contato para testes

# Configuração de logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="tests-curl-sh/resultado"
LOG_FILE="${LOG_DIR}/test-deal-controller_${TIMESTAMP}.log"
SUMMARY_FILE="${LOG_DIR}/summary-deal_${TIMESTAMP}.txt"

# Criar diretório de logs se não existir
mkdir -p "${LOG_DIR}"

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Função para log
log() {
    echo -e "$1" | tee -a "${LOG_FILE}"
}

# Função para log sem cores (para arquivo)
log_plain() {
    echo "$1" >> "${LOG_FILE}"
}

# Função para imprimir cabeçalhos
print_header() {
    log "\n${BLUE}========================================${NC}"
    log "${BLUE}$1${NC}"
    log "${BLUE}========================================${NC}\n"
    log_plain ""
    log_plain "========================================"
    log_plain "$1"
    log_plain "========================================"
    log_plain ""
}

# Função para imprimir sucesso
print_success() {
    log "${GREEN}✅ $1${NC}\n"
    log_plain "✅ $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

# Função para imprimir erro
print_error() {
    log "${RED}❌ $1${NC}\n"
    log_plain "❌ $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

# Função para fazer requisição e mostrar resultado
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_status=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log "${YELLOW}Testando: ${description}${NC}"
    log "Método: ${method}"
    log "Endpoint: ${BASE_URL}${endpoint}"
    log_plain "Testando: ${description}"
    log_plain "Método: ${method}"
    log_plain "Endpoint: ${BASE_URL}${endpoint}"
    
    if [ -n "$data" ]; then
        log "Dados: ${data}\n"
        log_plain "Dados: ${data}"
        log_plain ""
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Accept-Language: pt" \
            -H "Content-Type: application/json" \
            -d "${data}")
    else
        log ""
        log_plain ""
        response=$(curl -s -w "\n%{http_code}" -X "${method}" \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Accept-Language: pt")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    log "Status: ${http_code}"
    log "Response:"
    log_plain "Status: ${http_code}"
    log_plain "Response:"
    
    formatted_body=$(echo "$body" | jq '.' 2>/dev/null || echo "$body")
    log "$formatted_body"
    log_plain "$formatted_body"
    
    if [ -n "$expected_status" ]; then
        if [ "$http_code" = "$expected_status" ]; then
            print_success "Sucesso! (Status ${http_code} esperado)"
        else
            print_error "Falhou! Esperado ${expected_status}, recebido ${http_code}"
        fi
    else
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            print_success "Sucesso!"
        else
            print_error "Falhou com status ${http_code}"
        fi
    fi
    
    log "${BLUE}----------------------------------------${NC}\n"
    log_plain "----------------------------------------"
    log_plain ""
    sleep 1
}

# Iniciar log
log "${GREEN}🧪 INICIANDO TESTES DO DEAL CONTROLLER${NC}"
log "Data: $(date '+%Y-%m-%d %H:%M:%S')"
log "Base URL: ${BASE_URL}"
log "Contact ID: ${CONTACT_ID}"
log_plain "🧪 INICIANDO TESTES DO DEAL CONTROLLER"
log_plain "Data: $(date '+%Y-%m-%d %H:%M:%S')"
log_plain "Base URL: ${BASE_URL}"
log_plain "Contact ID: ${CONTACT_ID}"
log_plain ""

# ==========================================
# PASSO 1: LOGIN
# ==========================================
print_header "PASSO 1: LOGIN"

log "Fazendo login para obter token..."
log_plain "Fazendo login para obter token..."
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
    log "$login_response" | jq '.'
    log_plain "$(echo "$login_response" | jq '.')"
    exit 1
fi

print_success "Login realizado com sucesso!"
log "Token: ${TOKEN:0:50}..."
log_plain "Token: ${TOKEN:0:50}..."

# ==========================================
# PASSO 2: CRIAR NEGOCIAÇÃO
# ==========================================
print_header "PASSO 2: POST /deals - Criar Negociação"

make_request "POST" "/deals" \
'{
    "contato_id": '${CONTACT_ID}',
    "titulo": "Negociação Teste Curl",
    "etapa_funil": "novo",
    "valor_total_cents": 250000,
    "origem": "teste_automatizado"
}' \
"Criar nova negociação"

# Extrair ID da negociação criada
DEAL_ID=$(curl -s -X GET \
    "${BASE_URL}/contacts/${CONTACT_ID}/deals" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept-Language: pt" | jq -r '.data[0].id')

if [ -z "$DEAL_ID" ] || [ "$DEAL_ID" = "null" ]; then
    print_error "Não foi possível obter o ID da negociação criada"
    log_plain "Não foi possível obter o ID da negociação criada"
    exit 1
fi

log "${GREEN}Negociação criada com ID: ${DEAL_ID}${NC}"
log_plain "Negociação criada com ID: ${DEAL_ID}"

# ==========================================
# PASSO 3: LISTAR NEGOCIAÇÕES
# ==========================================
print_header "PASSO 3: GET /deals - Listar Negociações"

make_request "GET" "/deals?limit=5&offset=0" "" \
"Listar negociações com paginação"

# ==========================================
# PASSO 4: BUSCAR NEGOCIAÇÃO POR ID
# ==========================================
print_header "PASSO 4: GET /deals/:id - Buscar por ID"

make_request "GET" "/deals/${DEAL_ID}" "" \
"Buscar negociação por ID"

# ==========================================
# PASSO 5: LISTAR NEGOCIAÇÕES DO CONTATO
# ==========================================
print_header "PASSO 5: GET /contacts/:id/deals - Negociações do Contato"

make_request "GET" "/contacts/${CONTACT_ID}/deals" "" \
"Listar todas as negociações do contato"

# ==========================================
# PASSO 6: ATUALIZAR NEGOCIAÇÃO
# ==========================================
print_header "PASSO 6: PUT /deals/:id - Atualizar Negociação"

make_request "PUT" "/deals/${DEAL_ID}" \
'{
    "titulo": "Negociação Atualizada",
    "valor_total_cents": 350000
}' \
"Atualizar título e valor da negociação"

# ==========================================
# PASSO 7: MOVER ETAPA DO FUNIL
# ==========================================
print_header "PASSO 7: PUT /deals/:id/stage - Mover Etapa"

make_request "PUT" "/deals/${DEAL_ID}/stage" \
'{
    "etapa_funil": "qualificacao"
}' \
"Mover negociação para etapa de qualificação"

# ==========================================
# PASSO 8: FILTRAR POR ETAPA
# ==========================================
print_header "PASSO 8: GET /deals?etapa_funil=qualificacao - Filtrar"

make_request "GET" "/deals?etapa_funil=qualificacao&limit=5" "" \
"Filtrar negociações por etapa do funil"

# ==========================================
# PASSO 9: FILTRAR POR STATUS (ABERTAS)
# ==========================================
print_header "PASSO 9: GET /deals?status=open - Negociações Abertas"

make_request "GET" "/deals?status=open&limit=5" "" \
"Filtrar apenas negociações abertas"

# ==========================================
# PASSO 10: ESTATÍSTICAS
# ==========================================
print_header "PASSO 10: GET /deals/stats - Estatísticas"

make_request "GET" "/deals/stats" "" \
"Obter estatísticas do funil de vendas"

# ==========================================
# PASSO 11: MARCAR COMO GANHA (WON)
# ==========================================
print_header "PASSO 11: PUT /deals/:id/win - Marcar como Ganha"

make_request "PUT" "/deals/${DEAL_ID}/win" "" \
"Marcar negociação como ganha (converte lead em cliente)"

# ==========================================
# PASSO 12: VERIFICAR NEGOCIAÇÕES GANHAS
# ==========================================
print_header "PASSO 12: GET /deals?status=won - Negociações Ganhas"

make_request "GET" "/deals?status=won&limit=5" "" \
"Listar negociações ganhas"

# ==========================================
# PASSO 13: REABRIR NEGOCIAÇÃO
# ==========================================
print_header "PASSO 13: PUT /deals/:id/reopen - Reabrir Negociação"

make_request "PUT" "/deals/${DEAL_ID}/reopen" "" \
"Reabrir negociação fechada"

# ==========================================
# PASSO 14: CRIAR SEGUNDA NEGOCIAÇÃO
# ==========================================
print_header "PASSO 14: POST /deals - Segunda Negociação"

make_request "POST" "/deals" \
'{
    "contato_id": '${CONTACT_ID}',
    "titulo": "Segunda Oportunidade",
    "etapa_funil": "proposta",
    "valor_total_cents": 500000,
    "origem": "indicacao"
}' \
"Criar segunda negociação para o mesmo contato"

# Pegar ID da segunda negociação
DEAL_ID_2=$(curl -s -X GET \
    "${BASE_URL}/contacts/${CONTACT_ID}/deals" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept-Language: pt" | jq -r '.data[0].id')

log "${GREEN}Segunda negociação criada com ID: ${DEAL_ID_2}${NC}"
log_plain "Segunda negociação criada com ID: ${DEAL_ID_2}"

# ==========================================
# PASSO 15: MARCAR COMO PERDIDA (LOST)
# ==========================================
print_header "PASSO 15: PUT /deals/:id/lose - Marcar como Perdida"

make_request "PUT" "/deals/${DEAL_ID_2}/lose" \
'{
    "reason": "Preço muito alto"
}' \
"Marcar segunda negociação como perdida"

# ==========================================
# PASSO 16: VERIFICAR NEGOCIAÇÕES PERDIDAS
# ==========================================
print_header "PASSO 16: GET /deals?status=lost - Negociações Perdidas"

make_request "GET" "/deals?status=lost&limit=5" "" \
"Listar negociações perdidas"

# ==========================================
# PASSO 17: BUSCAR COM TEXTO
# ==========================================
print_header "PASSO 17: GET /deals?search=Oportunidade - Buscar"

make_request "GET" "/deals?search=Oportunidade&limit=5" "" \
"Buscar negociações por texto"

# ==========================================
# PASSO 18: EXCLUIR NEGOCIAÇÃO
# ==========================================
print_header "PASSO 18: DELETE /deals/:id - Soft Delete"

make_request "DELETE" "/deals/${DEAL_ID_2}" "" \
"Excluir negociação (soft delete)"

# ==========================================
# PASSO 19: VERIFICAR EXCLUSÃO
# ==========================================
print_header "PASSO 19: GET /deals/:id - Verificar Exclusão"

make_request "GET" "/deals/${DEAL_ID_2}" "" \
"Tentar buscar negociação deletada (deve retornar 404)" "404"

# ==========================================
# PASSO 20: VALIDAÇÃO - SEM CONTATO_ID
# ==========================================
print_header "PASSO 20: POST /deals - Validação sem contato_id"

make_request "POST" "/deals" \
'{
    "titulo": "Negociação Sem Contato"
}' \
"Tentar criar negociação sem contato_id (deve falhar)" "400"

# ==========================================
# PASSO 21: VALIDAÇÃO - SEM TÍTULO
# ==========================================
print_header "PASSO 21: POST /deals - Validação sem título"

make_request "POST" "/deals" \
'{
    "contato_id": '${CONTACT_ID}'
}' \
"Tentar criar negociação sem título (deve falhar)" "400"

# ==========================================
# PASSO 22: VALIDAÇÃO - CONTATO INEXISTENTE
# ==========================================
print_header "PASSO 22: POST /deals - Contato Inexistente"

make_request "POST" "/deals" \
'{
    "contato_id": 999999,
    "titulo": "Negociação com Contato Inexistente"
}' \
"Tentar criar negociação com contato inexistente (deve falhar)" "404"

# ==========================================
# RESUMO FINAL
# ==========================================
print_header "RESUMO DOS TESTES"

SUCCESS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
fi

log "${GREEN}✅ Testes concluídos!${NC}\n"
log_plain "✅ Testes concluídos!"
log_plain ""

log "📊 Estatísticas:"
log "   Total de testes: ${TOTAL_TESTS}"
log "   ✅ Passaram: ${PASSED_TESTS}"
log "   ❌ Falharam: ${FAILED_TESTS}"
log "   📈 Taxa de sucesso: ${SUCCESS_RATE}%"
log ""

log_plain "📊 Estatísticas:"
log_plain "   Total de testes: ${TOTAL_TESTS}"
log_plain "   ✅ Passaram: ${PASSED_TESTS}"
log_plain "   ❌ Falharam: ${FAILED_TESTS}"
log_plain "   📈 Taxa de sucesso: ${SUCCESS_RATE}%"
log_plain ""

log "Endpoints testados:"
log "  ✓ POST   /api/v1/auth/login"
log "  ✓ POST   /api/v1/deals"
log "  ✓ GET    /api/v1/deals"
log "  ✓ GET    /api/v1/deals/:id"
log "  ✓ GET    /api/v1/contacts/:id/deals"
log "  ✓ PUT    /api/v1/deals/:id"
log "  ✓ PUT    /api/v1/deals/:id/stage"
log "  ✓ PUT    /api/v1/deals/:id/win"
log "  ✓ PUT    /api/v1/deals/:id/lose"
log "  ✓ PUT    /api/v1/deals/:id/reopen"
log "  ✓ GET    /api/v1/deals/stats"
log "  ✓ DELETE /api/v1/deals/:id"
log ""

log_plain "Endpoints testados:"
log_plain "  ✓ POST   /api/v1/auth/login"
log_plain "  ✓ POST   /api/v1/deals"
log_plain "  ✓ GET    /api/v1/deals"
log_plain "  ✓ GET    /api/v1/deals/:id"
log_plain "  ✓ GET    /api/v1/contacts/:id/deals"
log_plain "  ✓ PUT    /api/v1/deals/:id"
log_plain "  ✓ PUT    /api/v1/deals/:id/stage"
log_plain "  ✓ PUT    /api/v1/deals/:id/win"
log_plain "  ✓ PUT    /api/v1/deals/:id/lose"
log_plain "  ✓ PUT    /api/v1/deals/:id/reopen"
log_plain "  ✓ GET    /api/v1/deals/stats"
log_plain "  ✓ DELETE /api/v1/deals/:id"
log_plain ""

# Gerar arquivo de resumo
cat > "${SUMMARY_FILE}" << EOF
==========================================
RESUMO DOS TESTES - DEAL CONTROLLER
==========================================
Data: $(date '+%Y-%m-%d %H:%M:%S')
Base URL: ${BASE_URL}
Contact ID: ${CONTACT_ID}

📊 ESTATÍSTICAS
----------------
Total de testes: ${TOTAL_TESTS}
✅ Passaram: ${PASSED_TESTS}
❌ Falharam: ${FAILED_TESTS}
📈 Taxa de sucesso: ${SUCCESS_RATE}%

STATUS FINAL
------------
EOF

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 TODOS OS TESTES PASSARAM!" >> "${SUMMARY_FILE}"
    echo "✅ Pipeline de vendas funcionando perfeitamente" >> "${SUMMARY_FILE}"
else
    echo "⚠️  ALGUNS TESTES FALHARAM" >> "${SUMMARY_FILE}"
    echo "❌ Verifique o log detalhado: ${LOG_FILE}" >> "${SUMMARY_FILE}"
fi

echo "" >> "${SUMMARY_FILE}"
echo "LOGS GERADOS" >> "${SUMMARY_FILE}"
echo "-------------" >> "${SUMMARY_FILE}"
echo "Log completo: ${LOG_FILE}" >> "${SUMMARY_FILE}"
echo "Resumo: ${SUMMARY_FILE}" >> "${SUMMARY_FILE}"
echo "===========================================" >> "${SUMMARY_FILE}"

log "${GREEN}📁 Logs salvos em:${NC}"
log "   📄 Log completo: ${LOG_FILE}"
log "   📋 Resumo: ${SUMMARY_FILE}"
log_plain "📁 Logs salvos em:"
log_plain "   📄 Log completo: ${LOG_FILE}"
log_plain "   📋 Resumo: ${SUMMARY_FILE}"

echo ""
cat "${SUMMARY_FILE}"
