#!/bin/bash

# ===================================================================
# TESTES DO NOVO ENDPOINT SCHEDULE POR EMPRESA
# ===================================================================

BASE_URL="http://localhost:3000/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU4IiwiZW1haWwiOiJwb2xvQHBvbG94LmNvbS5iciIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImNvbXBhbnlJZCI6IjI1IiwiaWF0IjoxNzYzMDQ3MTM5LCJleHAiOjE3NjMxMzM1Mzl9.pte_-P8Qk6u18T8s1RQFll--30E27y8EkEmSm4Wi6Ys"
COMPANY_ID=25

echo "🚀 Testando novo endpoint de eventos por empresa..."
echo "=================================================="

# Teste 1: Endpoint básico com filtros obrigatórios
echo ""
echo "📋 Teste 1: Buscar eventos do mês atual"
echo "----------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 2: Filtrar por contato específico
echo ""
echo "📋 Teste 2: Filtrar por contato específico (ID 16)"
echo "---------------------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30&contato_id=16" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 3: Filtrar por tipo de evento
echo ""
echo "📋 Teste 3: Filtrar apenas reuniões"
echo "------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30&event_type=meeting" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 4: Busca por texto
echo ""
echo "📋 Teste 4: Busca por texto 'cliente'"
echo "--------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30&search=cliente" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 5: Ordenação e paginação
echo ""
echo "📋 Teste 5: Com ordenação e paginação"
echo "--------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30&sort_by=start_datetime&sort_order=DESC&limit=10&offset=0" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 6: Erro - sem datas obrigatórias
echo ""
echo "❌ Teste 6: Erro esperado - sem datas obrigatórias"
echo "---------------------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 7: Erro - data inválida
echo ""
echo "❌ Teste 7: Erro esperado - formato de data inválido"
echo "-----------------------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-13-01&end_date=2025-12-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Teste 8: Comparação com endpoint original
echo ""
echo "📊 Teste 8: Comparação com endpoint original (com aviso de descontinuação)"
echo "--------------------------------------------------------------------------"
curl -X GET \
  "${BASE_URL}/schedule/events?limit=50" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

echo ""
echo "✅ Testes concluídos!"
echo ""
echo "🔍 Pontos observados:"
echo "- Novo endpoint obriga company_id como parâmetro de rota"
echo "- Filtros start_date e end_date são obrigatórios"
echo "- IDs retornam como integers em vez de strings"
echo "- contato_id é filtro opcional"
echo "- Inclui estatísticas do período consultado"
echo "- Endpoint original mantido com aviso de descontinuação"