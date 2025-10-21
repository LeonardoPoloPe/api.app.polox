# 🧹 Plano de Limpeza da Documentação

## ❌ ARQUIVOS PARA REMOVER:
- `CHECKLIST_PROXIMA_SESSAO.md` - Status pontual ultrapassado
- `RELATORIO_PROGRESSO_19_10_2025.md` - Relatório específico da sessão

## 📁 ARQUIVOS PARA MOVER PARA `archive/`:
- `COPILOT_PROMPT_1_COMPLETE.md` - Histórico interessante
- `COPILOT_PROMPT_2_COMPLETO.md` - Histórico interessante
- `resumo-estrutura.md` - Versão antiga

## ✅ ARQUIVOS ESSENCIAIS (MANTER):
- `MIGRATION_PLAYBOOK.md` ⭐⭐⭐⭐⭐
- `COMANDOS_RAPIDOS.md` ⭐⭐⭐⭐
- `AWS_SETUP_INSTRUCTIONS.md` ⭐⭐⭐⭐
- `ESTRUTURA_PROJETO.md` ⭐⭐⭐⭐
- `ISSUES_SOLUCOES.md` ⭐⭐⭐
- `STATUS_RDS_PROXY.md` ⭐⭐⭐
- `CONSULTA_PARAMETROS_AWS.md` ⭐⭐⭐
- `README.md` ⭐⭐⭐
- `SWAGGER.md` ⭐⭐⭐
- `COMANDOS_DEPLOY.md` ⭐⭐⭐

## 📋 AÇÕES SUGERIDAS:

### 1. Criar pasta archive:
```bash
mkdir docs/archive
```

### 2. Mover históricos:
```bash
mv docs/COPILOT_PROMPT_*_COMPLETE.md docs/archive/
mv docs/resumo-estrutura.md docs/archive/
```

### 3. Remover lixo:
```bash
rm docs/CHECKLIST_PROXIMA_SESSAO.md
rm docs/RELATORIO_PROGRESSO_19_10_2025.md
```

### 4. Consolidar estrutura:
```bash
# Manter apenas resumo-estrutura-v02.md OU consolidar com ESTRUTURA_PROJETO.md
```

## 🎯 RESULTADO FINAL:
**12 arquivos essenciais** mantidos na raiz do `/docs`
**4 arquivos históricos** movidos para `/archive`
**2 arquivos lixo** removidos

Total: **Redução de 25% da documentação** mantendo 100% da informação útil.