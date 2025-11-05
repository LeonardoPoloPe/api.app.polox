#!/bin/bash

# ==========================================
# 🧪 BATERIA COMPLETA DE TESTES - POLOX API
# ==========================================
# Executa todos os testes de controllers
# 
# Uso: bash run-all-tests.sh [controller]
#   
# Exemplos:
#   bash run-all-tests.sh              # Roda todos
#   bash run-all-tests.sh contact      # Roda apenas ContactController
#   bash run-all-tests.sh deal         # Roda apenas DealController
#   bash run-all-tests.sh note         # Roda apenas ContactNoteController

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Timestamp para os logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MASTER_LOG="tests-curl-sh/resultado/master-test_${TIMESTAMP}.log"

# Contadores
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Criar diretório de logs
mkdir -p tests-curl-sh/resultado

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║        🧪 BATERIA COMPLETA DE TESTES - POLOX API        ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Data: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}Log Master: ${MASTER_LOG}${NC}"
echo ""

# Função para rodar um teste
run_test() {
    local test_name=$1
    local script_path=$2
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚡ Executando: ${test_name}${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando ${test_name}" >> "${MASTER_LOG}"
    
    if [ -f "${script_path}" ]; then
        if bash "${script_path}"; then
            echo -e "${GREEN}✅ ${test_name} - PASSOU${NC}\n"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${test_name} - PASSOU" >> "${MASTER_LOG}"
            PASSED_SUITES=$((PASSED_SUITES + 1))
        else
            echo -e "${RED}❌ ${test_name} - FALHOU${NC}\n"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${test_name} - FALHOU" >> "${MASTER_LOG}"
            FAILED_SUITES=$((FAILED_SUITES + 1))
        fi
    else
        echo -e "${RED}❌ Script não encontrado: ${script_path}${NC}\n"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${test_name} - SCRIPT NÃO ENCONTRADO" >> "${MASTER_LOG}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
    fi
    
    echo ""
    sleep 2
}

# Verificar se foi especificado um controller específico
SPECIFIC_TEST=$1

if [ -z "$SPECIFIC_TEST" ]; then
    echo -e "${CYAN}🚀 Rodando TODOS os testes disponíveis...${NC}\n"
    
    # ContactController
    run_test "ContactController" "tests-curl-sh/test-contact-controller.sh"
    
    # DealController
    run_test "DealController" "tests-curl-sh/test-deal-controller.sh"
    
    # ContactNoteController
    run_test "ContactNoteController" "tests-curl-sh/test-contact-note-controller.sh"
    
else
    case "$SPECIFIC_TEST" in
        contact|contacts)
            echo -e "${CYAN}🚀 Rodando apenas ContactController...${NC}\n"
            run_test "ContactController" "tests-curl-sh/test-contact-controller.sh"
            ;;
        deal|deals)
            echo -e "${CYAN}🚀 Rodando apenas DealController...${NC}\n"
            run_test "DealController" "tests-curl-sh/test-deal-controller.sh"
            ;;
        note|notes)
            echo -e "${CYAN}🚀 Rodando apenas ContactNoteController...${NC}\n"
            run_test "ContactNoteController" "tests-curl-sh/test-contact-note-controller.sh"
            ;;
        *)
            echo -e "${RED}❌ Controller não reconhecido: ${SPECIFIC_TEST}${NC}"
            echo ""
            echo "Controllers disponíveis:"
            echo "  - contact  (ContactController)"
            echo "  - deal     (DealController)"
            echo "  - note     (ContactNoteController)"
            echo ""
            exit 1
            ;;
    esac
fi

# Resumo Final
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║                    📊 RESUMO FINAL                       ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

SUCCESS_RATE=0
if [ $TOTAL_SUITES -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_SUITES/$TOTAL_SUITES)*100}")
fi

echo -e "${BLUE}Total de suites: ${TOTAL_SUITES}${NC}"
echo -e "${GREEN}✅ Passaram: ${PASSED_SUITES}${NC}"
echo -e "${RED}❌ Falharam: ${FAILED_SUITES}${NC}"
echo -e "${YELLOW}📈 Taxa de sucesso: ${SUCCESS_RATE}%${NC}"
echo ""

# Listar logs gerados
echo -e "${BLUE}📁 Logs gerados:${NC}"
ls -lt tests-curl-sh/resultado/*_${TIMESTAMP}* 2>/dev/null | head -10 | while read -r line; do
    echo "   $(echo "$line" | awk '{print $9}')"
done
echo ""

# Status final
if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║       🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 🎉       ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║            ✅ Sistema pronto para produção ✅            ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║         ⚠️  ALGUNS TESTES FALHARAM  ⚠️                  ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║      Verifique os logs para mais detalhes               ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
