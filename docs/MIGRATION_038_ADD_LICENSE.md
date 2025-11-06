# 🔧 Migration 038: Adicionar "license" ao company_type

## 📋 Descrição
Esta migration adiciona o valor `"license"` ao check constraint da coluna `company_type` na tabela `polox.companies`, permitindo criar empresas do tipo licenciada.

## 🎯 Objetivo
Permitir que o sistema suporte três tipos de empresas:
- **tenant**: Cliente final
- **partner**: Parceiro/Revendedor  
- **license**: Empresa licenciada

## 🚀 Como Executar

### Opção 1: Via SQL Direto (RECOMENDADO)

Execute o arquivo SQL no seu banco de dados:

```bash
psql -U seu_usuario -d seu_banco -f sql/038_add_license_to_company_type.sql
```

Ou copie e execute diretamente no seu client SQL (DBeaver, pgAdmin, etc):

```sql
BEGIN;

ALTER TABLE polox.companies 
DROP CONSTRAINT IF EXISTS companies_company_type_check;

ALTER TABLE polox.companies
ADD CONSTRAINT companies_company_type_check 
CHECK (company_type IN ('tenant', 'partner', 'license'));

COMMIT;
```

### Opção 2: Via Script Node.js

Se o banco estiver acessível localmente:

```bash
node migrations/038_add_license_to_company_type.js
```

## ✅ Verificação

Após executar a migration, verifique se a constraint foi criada corretamente:

```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'companies_company_type_check';
```

**Resultado esperado:**
```
conname: companies_company_type_check
pg_get_constraintdef: CHECK ((company_type = ANY (ARRAY['tenant'::text, 'partner'::text, 'license'::text])))
```

## 🧪 Teste

Após executar a migration, teste criando/atualizando uma empresa com `company_type: "license"`:

```bash
curl -X 'PUT' \
  'http://localhost:3000/api/v1/companies/25' \
  -H 'accept: */*' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "company_type": "license",
    "status": "active"
  }'
```

## 🔄 Rollback

Para reverter esta migration:

```sql
BEGIN;

ALTER TABLE polox.companies 
DROP CONSTRAINT IF EXISTS companies_company_type_check;

ALTER TABLE polox.companies
ADD CONSTRAINT companies_company_type_check 
CHECK (company_type IN ('tenant', 'partner'));

COMMIT;
```

## 📝 Notas

- Esta migration é **segura** e pode ser executada em produção
- Não afeta dados existentes
- Apenas adiciona uma nova opção ao check constraint
- Não há perda de dados no rollback (desde que não existam registros com `company_type = 'license'`)

## 🔗 Arquivos Relacionados

- `migrations/038_add_license_to_company_type.js` - Script Node.js
- `sql/038_add_license_to_company_type.sql` - Script SQL puro
- `src/controllers/CompanyController.js` - Validação Joi já atualizada
- `src/routes/companies.js` - Swagger já atualizado
