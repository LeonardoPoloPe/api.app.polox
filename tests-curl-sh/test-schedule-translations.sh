#!/bin/bash

# ===================================================================
# TESTE DAS TRADUÇÕES DO NOVO ENDPOINT SCHEDULE POR EMPRESA
# ===================================================================

BASE_URL="http://localhost:3000/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU4IiwiZW1haWwiOiJwb2xvQHBvbG94LmNvbS5iciIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImNvbXBhbnlJZCI6IjI1IiwiaWF0IjoxNzYzMDQ3MTM5LCJleHAiOjE3NjMxMzM1Mzl9.pte_-P8Qk6u18T8s1RQFll--30E27y8EkEmSm4Wi6Ys"
COMPANY_ID=25

echo "🌍 Testando traduções do novo endpoint de eventos por empresa..."
echo "=============================================================="

# Teste 1: Português (PT)
echo ""
echo "🇧🇷 Teste 1: Português (PT-BR)"
echo "--------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 2: Inglês (EN)
echo ""
echo "🇺🇸 Teste 2: Inglês (EN)"
echo "------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: en" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 3: Espanhol (ES)
echo ""
echo "🇪🇸 Teste 3: Espanhol (ES)"
echo "--------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: es" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 4: Erro de datas - PT
echo ""
echo "❌ Teste 4: Erro de validação em Português"
echo "-------------------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 5: Erro de datas - EN
echo ""
echo "❌ Teste 5: Erro de validação em Inglês"
echo "---------------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events" \
  -H "Accept: application/json" \
  -H "Accept-Language: en" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 6: Erro de datas - ES
echo ""
echo "❌ Teste 6: Erro de validação em Espanhol"
echo "-----------------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events" \
  -H "Accept: application/json" \
  -H "Accept-Language: es" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 7: Erro de acesso à empresa - PT
echo ""
echo "🔒 Teste 7: Erro de acesso à empresa diferente - PT"
echo "---------------------------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/999/events?start_date=2025-11-01&end_date=2025-11-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

# Teste 8: Erro de formato de data - EN
echo ""
echo "📅 Teste 8: Erro de formato de data - EN"
echo "----------------------------------------"
curl -s -X GET \
  "${BASE_URL}/schedule/companies/${COMPANY_ID}/events?start_date=2025-13-01&end_date=2025-12-30" \
  -H "Accept: application/json" \
  -H "Accept-Language: en" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.message'

echo ""
echo "✅ Testes de tradução concluídos!"
echo ""
echo "📋 Resumo dos testes:"
echo "- Mensagens de sucesso em 3 idiomas"
echo "- Mensagens de erro de validação em 3 idiomas" 
echo "- Mensagens de erro de acesso"
echo "- Mensagens de erro de formato"
echo ""
echo "🔍 Verifique se as mensagens estão traduzidas corretamente acima!"