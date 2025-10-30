# ✅ Checklist de Migrations e Qualidade

Preencha antes de pedir revisão. PRs que alteram banco sem checklist serão bloqueados.

## Migrations

- [ ] Criei a migration com nome sequencial (ex.: `035_descricao_curta`)
- [ ] Rodei em TEST (app_polox_test) com sucesso
- [ ] Rodei testes de integração após a migration
- [ ] Rodei em DEV com sucesso
- [ ] Validei em SANDBOX (se aplicável)
- [ ] Plano/Janela para PROD definido no card (se aplicável)

## Comandos executados (cole os outputs principais)

- TEST status/migrate:
  - `node scripts/migrate-test.js status`
  - `node scripts/migrate-test.js migrate`
- DEV status/migrate:
  - `npm run migrate:dev:status`
  - `npm run migrate:dev:run`

## Risco e rollback

- [ ] É idempotente (verifica existência antes de criar/alterar)
- [ ] Tem caminho de rollback (ou justificativa)
- [ ] Dados sensíveis preservados/criptografados (quando necessário)

## Documentação

- [ ] Atualizei `docs/GUIA_MIGRATIONS_COMPLETO.md` (se necessário)
- [ ] Atualizei `CHANGELOG.md`/relatório em `docs/atualizacoes` (se necessário)

## Observações

Descreva decisões, janelas de manutenção, dependências de app, etc.
