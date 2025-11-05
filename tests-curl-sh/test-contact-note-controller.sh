#!/bin/bash

# ==========================================
# 🧪 TESTES MANUAIS - CONTACT NOTE CONTROLLER
# ==========================================
# Script para testar todos os endpoints do ContactNoteController via curl
# Sistema de Histórico de Interações
# 
# Uso: bash test-contact-note-controller.sh

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
LOG_FILE="${LOG_DIR}/test-contact-note_${TIMESTAMP}.log"
SUMMARY_FILE="${LOG_DIR}/summary-contact-note_${TIMESTAMP}.txt"

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

# Função para fazer requisição
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
log "${GREEN}🧪 INICIANDO TESTES DO CONTACT NOTE CONTROLLER${NC}"
log "Data: $(date '+%Y-%m-%d %H:%M:%S')"
log "Base URL: ${BASE_URL}"
log "Contact ID: ${CONTACT_ID}"
log_plain "🧪 INICIANDO TESTES DO CONTACT NOTE CONTROLLER"
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
# PASSO 2: CRIAR NOTA
# ==========================================
print_header "PASSO 2: POST /contacts/:id/notes - Criar Nota"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Primeira reunião realizada. Cliente demonstrou interesse no produto.",
    "tipo": "nota"
}' \
"Criar nova nota para o contato"

# Extrair ID da nota criada
NOTE_ID=$(curl -s -X GET \
    "${BASE_URL}/contacts/${CONTACT_ID}/notes?limit=1" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept-Language: pt" | jq -r '.data[0].id')

if [ -z "$NOTE_ID" ] || [ "$NOTE_ID" = "null" ]; then
    print_error "Não foi possível obter o ID da nota criada"
    log_plain "Não foi possível obter o ID da nota criada"
    exit 1
fi

log "${GREEN}Nota criada com ID: ${NOTE_ID}${NC}"
log_plain "Nota criada com ID: ${NOTE_ID}"

# ==========================================
# PASSO 3: CRIAR NOTA TIPO LIGAÇÃO
# ==========================================
print_header "PASSO 3: POST /contacts/:id/notes - Nota Ligação"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Ligação realizada às 14h. Cliente pediu mais informações sobre preços.",
    "tipo": "ligacao"
}' \
"Criar nota do tipo ligação"

# ==========================================
# PASSO 4: CRIAR NOTA TIPO EMAIL
# ==========================================
print_header "PASSO 4: POST /contacts/:id/notes - Nota Email"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Email enviado com proposta comercial detalhada.",
    "tipo": "email"
}' \
"Criar nota do tipo email"

# ==========================================
# PASSO 5: CRIAR NOTA TIPO REUNIÃO
# ==========================================
print_header "PASSO 5: POST /contacts/:id/notes - Nota Reunião"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Reunião presencial agendada para próxima semana.",
    "tipo": "reuniao",
    "metadata": {
        "data_agendada": "2025-11-12T10:00:00Z",
        "local": "Escritório Central"
    }
}' \
"Criar nota do tipo reunião com metadata"

# ==========================================
# PASSO 6: CRIAR NOTA TIPO WHATSAPP
# ==========================================
print_header "PASSO 6: POST /contacts/:id/notes - Nota WhatsApp"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Mensagem via WhatsApp: cliente confirmou interesse.",
    "tipo": "whatsapp"
}' \
"Criar nota do tipo whatsapp"

# ==========================================
# PASSO 7: LISTAR TODAS AS NOTAS
# ==========================================
print_header "PASSO 7: GET /notes - Listar Todas as Notas"

make_request "GET" "/notes?limit=10&offset=0" "" \
"Listar todas as notas da empresa"

# ==========================================
# PASSO 8: LISTAR NOTAS DO CONTATO
# ==========================================
print_header "PASSO 8: GET /contacts/:id/notes - Notas do Contato"

make_request "GET" "/contacts/${CONTACT_ID}/notes?limit=10" "" \
"Listar todas as notas do contato específico"

# ==========================================
# PASSO 9: BUSCAR NOTA POR ID
# ==========================================
print_header "PASSO 9: GET /notes/:id - Buscar por ID"

make_request "GET" "/notes/${NOTE_ID}" "" \
"Buscar nota específica por ID"

# ==========================================
# PASSO 10: FILTRAR POR TIPO
# ==========================================
print_header "PASSO 10: GET /notes?tipo=ligacao - Filtrar por Tipo"

make_request "GET" "/notes?tipo=ligacao&limit=5" "" \
"Filtrar apenas notas do tipo ligação"

# ==========================================
# PASSO 11: ATUALIZAR NOTA
# ==========================================
print_header "PASSO 11: PUT /notes/:id - Atualizar Nota"

make_request "PUT" "/notes/${NOTE_ID}" \
'{
    "content": "Primeira reunião realizada. Cliente demonstrou MUITO interesse no produto. Follow-up agendado.",
    "tipo": "reuniao"
}' \
"Atualizar conteúdo e tipo da nota"

# ==========================================
# PASSO 12: NOTAS RECENTES DO CONTATO
# ==========================================
print_header "PASSO 12: GET /contacts/:id/notes/recent - Notas Recentes"

make_request "GET" "/contacts/${CONTACT_ID}/notes/recent?limit=3" "" \
"Buscar as 3 notas mais recentes do contato"

# ==========================================
# PASSO 13: ESTATÍSTICAS DO CONTATO
# ==========================================
print_header "PASSO 13: GET /contacts/:id/notes/stats - Estatísticas"

make_request "GET" "/contacts/${CONTACT_ID}/notes/stats" "" \
"Obter estatísticas de interações do contato"

# ==========================================
# PASSO 14: ESTATÍSTICAS DA EMPRESA
# ==========================================
print_header "PASSO 14: GET /notes/stats - Estatísticas Gerais"

make_request "GET" "/notes/stats" "" \
"Obter estatísticas gerais de todas as notas"

# ==========================================
# PASSO 15: BUSCAR COM TEXTO
# ==========================================
print_header "PASSO 15: GET /notes?search=proposta - Buscar por Texto"

make_request "GET" "/notes?search=proposta&limit=5" "" \
"Buscar notas por texto no conteúdo"

# ==========================================
# PASSO 16: EXCLUIR NOTA
# ==========================================
print_header "PASSO 16: DELETE /notes/:id - Soft Delete"

make_request "DELETE" "/notes/${NOTE_ID}" "" \
"Excluir nota (soft delete)"

# ==========================================
# PASSO 17: VERIFICAR EXCLUSÃO
# ==========================================
print_header "PASSO 17: GET /notes/:id - Verificar Exclusão"

make_request "GET" "/notes/${NOTE_ID}" "" \
"Tentar buscar nota deletada (deve retornar 404)" "404"

# ==========================================
# PASSO 18: VALIDAÇÃO - SEM CONTEÚDO
# ==========================================
print_header "PASSO 18: POST /contacts/:id/notes - Validação sem conteúdo"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "tipo": "nota"
}' \
"Tentar criar nota sem conteúdo (deve falhar)" "400"

# ==========================================
# PASSO 19: VALIDAÇÃO - CONTEÚDO MUITO CURTO
# ==========================================
print_header "PASSO 19: POST /contacts/:id/notes - Conteúdo Curto"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Ok"
}' \
"Tentar criar nota com conteúdo muito curto (deve falhar)" "400"

# ==========================================
# PASSO 20: VALIDAÇÃO - TIPO INVÁLIDO
# ==========================================
print_header "PASSO 20: POST /contacts/:id/notes - Tipo Inválido"

make_request "POST" "/contacts/${CONTACT_ID}/notes" \
'{
    "content": "Teste de tipo inválido",
    "tipo": "tipo_invalido"
}' \
"Tentar criar nota com tipo inválido (deve falhar)" "400"

# ==========================================
# PASSO 21: VALIDAÇÃO - CONTATO INEXISTENTE
# ==========================================
print_header "PASSO 21: POST /contacts/999999/notes - Contato Inexistente"

make_request "POST" "/contacts/999999/notes" \
'{
    "content": "Nota para contato que não existe"
}' \
"Tentar criar nota para contato inexistente (deve falhar)" "404"

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
log "  ✓ POST   /api/v1/contacts/:id/notes"
log "  ✓ GET    /api/v1/notes"
log "  ✓ GET    /api/v1/contacts/:id/notes"
log "  ✓ GET    /api/v1/notes/:id"
log "  ✓ PUT    /api/v1/notes/:id"
log "  ✓ GET    /api/v1/contacts/:id/notes/recent"
log "  ✓ GET    /api/v1/contacts/:id/notes/stats"
log "  ✓ GET    /api/v1/notes/stats"
log "  ✓ DELETE /api/v1/notes/:id"
log ""

log_plain "Endpoints testados:"
log_plain "  ✓ POST   /api/v1/auth/login"
log_plain "  ✓ POST   /api/v1/contacts/:id/notes"
log_plain "  ✓ GET    /api/v1/notes"
log_plain "  ✓ GET    /api/v1/contacts/:id/notes"
log_plain "  ✓ GET    /api/v1/notes/:id"
log_plain "  ✓ PUT    /api/v1/notes/:id"
log_plain "  ✓ GET    /api/v1/contacts/:id/notes/recent"
log_plain "  ✓ GET    /api/v1/contacts/:id/notes/stats"
log_plain "  ✓ GET    /api/v1/notes/stats"
log_plain "  ✓ DELETE /api/v1/notes/:id"
log_plain ""

# Gerar arquivo de resumo
cat > "${SUMMARY_FILE}" << EOF
==========================================
RESUMO DOS TESTES - CONTACT NOTE CONTROLLER
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
    echo "✅ Sistema de histórico funcionando perfeitamente" >> "${SUMMARY_FILE}"
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
