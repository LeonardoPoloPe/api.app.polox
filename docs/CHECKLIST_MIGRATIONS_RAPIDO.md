# 🧭 Checklist Rápido de Migrations

> Objetivo: garantir que toda migration rode em TEST → DEV → SANDBOX → PROD de forma previsível e auditável.

## 1) TEST (sempre primeiro)

- Banco: app_polox_test
- Credenciais: reutiliza o Secret DEV via AWS Secrets Manager (dev-mysql)

Comandos (PowerShell):

```powershell
# Status / Aplicar
node scripts/migrate-test.js status
node scripts/migrate-test.js migrate
node scripts/migrate-test.js status

# Rodar testes de integração sem re-migrar no setup
$env:TEST_SKIP_MIGRATIONS = '1'
npm run test:integration
$env:TEST_SKIP_MIGRATIONS = $null
```

## 2) DEV

```powershell
npm run migrate:dev:status
npm run migrate:dev:run
npm run migrate:dev:status
```

## 3) SANDBOX

```powershell
npm run migrate:sandbox:status
npm run migrate:sandbox
npm run migrate:sandbox:status
```

## 4) PROD (com cuidado)

```powershell
npm run migrate:prod:status
npm run migrate:prod   # tem proteção e delay
npm run migrate:prod:status
```

## Boas Práticas

- Idempotência: sempre checar existência de objetos antes de criar/alterar.
- Transações: use BEGIN/COMMIT/ROLLBACK nas migrations complexas.
- Backfill seguro: faça em blocos/checado e com índices criados antes de consultas pesadas.
- Observabilidade: documente em `docs/atualizacoes` quando impactar produção.

## Reforço para o time

- PR Template: arquivo `.github/pull_request_template.md` com checklist obrigatório.
- CI opcional: workflow `.github/workflows/migrations-test.yml` roda migrations em TEST e testes de integração quando os segredos CI estiverem configurados.
- Scripts de verificação: `npm run migrate:check-all` para ver status de DEV/SANDBOX/PROD num só relatório.

## Referências

- `docs/GUIA_MIGRATIONS_COMPLETO.md`
- `scripts/migrate-environment.js`
- `scripts/migrate-test.js`
