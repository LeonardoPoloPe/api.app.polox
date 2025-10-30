#!/bin/bash
# 🚀 COMANDOS ÚTEIS PARA TESTES PRÉ-PRODUÇÃO

echo "📊 COMANDOS DE TESTES - API POLOX"
echo "=================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ==========================================
# TESTES BÁSICOS
# ==========================================

echo "${GREEN}📦 1. RODAR TODOS OS TESTES${NC}"
echo "npm test"
echo ""

echo "${GREEN}📊 2. RODAR COM COBERTURA${NC}"
echo "npm test -- --coverage"
echo ""

echo "${GREEN}🔍 3. GERAR RELATÓRIO HTML DE COBERTURA${NC}"
echo "npm test -- --coverage --coverageReporters=html"
echo "open coverage/index.html  # Abrir no navegador"
echo ""

# ==========================================
# TESTES POR CATEGORIA
# ==========================================

echo "${YELLOW}🎯 TESTES POR CATEGORIA${NC}"
echo ""

echo "4. Testes Unitários"
echo "npm run test:unit"
echo ""

echo "5. Testes de Integração"
echo "npm run test:integration"
echo ""

echo "6. Testes de Validação"
echo "npm run test:validation"
echo ""

echo "7. Testes de Performance"
echo "npm run test:performance"
echo ""

echo "8. Testes de Relacionamentos"
echo "npm run test:relationships"
echo ""

# ==========================================
# TESTES ESPECÍFICOS (NOVOS)
# ==========================================

echo "${YELLOW}🔐 TESTES DE SEGURANÇA (PRIORITÁRIOS!)${NC}"
echo ""

echo "9. Testes de Autenticação"
echo "npm test -- tests/integration/auth.test.js"
echo ""

echo "10. Testes de Autorização (criar depois)"
echo "npm test -- tests/integration/authorization.test.js"
echo ""

echo "11. Testes de Middleware de Segurança (criar depois)"
echo "npm test -- tests/integration/security-middleware.test.js"
echo ""

# ==========================================
# TESTES DE CONTROLLERS
# ==========================================

echo "${YELLOW}📦 TESTES DE CONTROLLERS${NC}"
echo ""

echo "12. Testes de Clients (criar)"
echo "npm test -- tests/integration/clients-crud.test.js"
echo ""

echo "13. Testes de Leads (criar)"
echo "npm test -- tests/integration/leads-crud.test.js"
echo ""

echo "14. Testes de Products (criar)"
echo "npm test -- tests/integration/products-crud.test.js"
echo ""

echo "15. Testes de Sales (criar)"
echo "npm test -- tests/integration/sales-crud.test.js"
echo ""

echo "16. Testes de Users (criar)"
echo "npm test -- tests/integration/users-crud.test.js"
echo ""

# ==========================================
# DESENVOLVIMENTO
# ==========================================

echo "${YELLOW}⚙️  COMANDOS DE DESENVOLVIMENTO${NC}"
echo ""

echo "17. Watch Mode (re-roda testes ao salvar)"
echo "npm test -- --watch"
echo ""

echo "18. Watch Mode + Coverage"
echo "npm test -- --watch --coverage"
echo ""

echo "19. Rodar teste específico com verbose"
echo "npm test -- --verbose auth.test.js"
echo ""

echo "20. Debug de teste"
echo "node --inspect-brk node_modules/.bin/jest --runInBand auth.test.js"
echo ""

# ==========================================
# COBERTURA E RELATÓRIOS
# ==========================================

echo "${YELLOW}📊 COBERTURA E RELATÓRIOS${NC}"
echo ""

echo "21. Cobertura com limiar mínimo"
echo "npm test -- --coverage --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'"
echo ""

echo "22. Cobertura apenas de controllers"
echo "npm test -- --coverage --collectCoverageFrom='src/controllers/**/*.js'"
echo ""

echo "23. Cobertura apenas de middleware"
echo "npm test -- --coverage --collectCoverageFrom='src/middleware/**/*.js'"
echo ""

echo "24. Ver arquivos não testados"
echo "npm test -- --coverage --coverageReporters=text | grep 'Uncovered'"
echo ""

# ==========================================
# CI/CD
# ==========================================

echo "${YELLOW}🔄 CI/CD${NC}"
echo ""

echo "25. Rodar testes como no CI (sequencial)"
echo "npm test -- --maxWorkers=1 --ci"
echo ""

echo "26. Rodar com timeout maior (testes lentos)"
echo "npm test -- --testTimeout=30000"
echo ""

# ==========================================
# LIMPEZA E MANUTENÇÃO
# ==========================================

echo "${YELLOW}🧹 LIMPEZA E MANUTENÇÃO${NC}"
echo ""

echo "27. Limpar cache do Jest"
echo "npm test -- --clearCache"
echo ""

echo "28. Re-rodar apenas testes que falharam"
echo "npm test -- --onlyFailures"
echo ""

echo "29. Rodar testes alterados (Git)"
echo "npm test -- --changedSince=main"
echo ""

# ==========================================
# INSTALAÇÃO DE DEPENDÊNCIAS
# ==========================================

echo "${RED}📦 INSTALAR DEPENDÊNCIAS ADICIONAIS${NC}"
echo ""

echo "30. Instalar ferramentas de teste"
echo "npm install --save-dev @faker-js/faker nock artillery"
echo ""

# ==========================================
# ANÁLISE DE QUALIDADE
# ==========================================

echo "${YELLOW}📈 ANÁLISE DE QUALIDADE${NC}"
echo ""

echo "31. Rodar ESLint"
echo "npm run lint"
echo ""

echo "32. Rodar ESLint com fix automático"
echo "npm run lint -- --fix"
echo ""

echo "33. Verificar vulnerabilidades"
echo "npm audit"
echo ""

echo "34. Corrigir vulnerabilidades"
echo "npm audit fix"
echo ""

# ==========================================
# COMANDOS ÚTEIS DO GIT
# ==========================================

echo "${YELLOW}🔀 GIT (Rastreamento de Mudanças)${NC}"
echo ""

echo "35. Ver arquivos alterados"
echo "git status"
echo ""

echo "36. Commitar mudanças de testes"
echo "git add tests/"
echo "git commit -m 'feat: add authentication tests'"
echo ""

echo "37. Ver diferenças"
echo "git diff tests/"
echo ""

# ==========================================
# ATALHOS ÚTEIS
# ==========================================

echo "${GREEN}⚡ ATALHOS RÁPIDOS${NC}"
echo ""

echo "38. Teste rápido (apenas arquivos alterados)"
echo "npm test -- --onlyChanged"
echo ""

echo "39. Teste específico por padrão de nome"
echo "npm test -- --testNamePattern='Login'"
echo ""

echo "40. Teste com output colorido"
echo "npm test -- --colors"
echo ""

# ==========================================
# PACKAGE.JSON SCRIPTS SUGERIDOS
# ==========================================

echo ""
echo "${RED}📝 ADICIONAR AO package.json:${NC}"
echo ""
cat << 'EOF'
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:coverage:html": "jest --coverage --coverageReporters=html && open coverage/index.html",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:security": "jest tests/security",
    "test:auth": "jest tests/integration/auth.test.js",
    "test:ci": "jest --maxWorkers=1 --ci --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:clear": "jest --clearCache",
    "lint": "eslint src tests",
    "lint:fix": "eslint src tests --fix"
  }
}
EOF

echo ""
echo "${GREEN}✅ COMANDOS PRONTOS! Use conforme necessário.${NC}"
echo ""
echo "💡 Dica: Comece com 'npm test -- tests/integration/auth.test.js'"
echo ""
