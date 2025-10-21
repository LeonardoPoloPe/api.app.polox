# 🔐 AWS SSM - Comandos Completos (Polox)

Este arquivo reúne comandos detalhados para gerenciar parâmetros no AWS Systems Manager Parameter Store, testar conectividade e executar migrações usando os secrets armazenados na nuvem.

> **Requisitos**: AWS CLI configurada e com permissões para acessar os parâmetros `/polox/*`.

---

## 🧪 **TESTE COMPLETO - TODOS OS AMBIENTES**

### 1) Verificar Status Geral (COMANDO PRINCIPAL)
```bash
# Testa conectividade, schema e migrações em DEV/SANDBOX/PROD
node scripts/test-ssm-migrations.js
```

**Saída esperada (Status Atual - 21/10/2025):**
```
DEV      ✅ OK (23 tabelas, 5 migrations)
SANDBOX  ✅ OK (13 tabelas, 2 migrations)  
PROD     ✅ OK (13 tabelas, 2 migrations)
🎉 TODOS OS AMBIENTES FUNCIONANDO COM AWS SSM!
```

**O que este comando faz:**
- ✅ Carrega credenciais do AWS SSM para cada ambiente
- ✅ Testa conectividade com cada banco de dados
- ✅ Lista todas as tabelas do schema `polox`
- ✅ Verifica histórico de migrações executadas
- ✅ Detecta problemas de proxy/host automaticamente

---

## 📊 **COMANDOS AWS CLI**

### 2) Listar TODOS os parâmetros do namespace `/polox`
```bash
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1
```

**Parâmetros disponíveis (21 no total):**
```
/polox/dev/db/host, /polox/dev/db/name, /polox/dev/db/user
/polox/dev/db/password (SecureString)
/polox/dev/jwt/secret (SecureString)  
/polox/dev/encryption/key (SecureString)

/polox/sandbox/db/host, /polox/sandbox/db/name, /polox/sandbox/db/user
/polox/sandbox/db/password (SecureString)
/polox/sandbox/jwt/secret (SecureString)

/polox/prod/db/host, /polox/prod/db/name, /polox/prod/db/user  
/polox/prod/db/proxy-host (para Lambda/ECS)
/polox/prod/db/password (SecureString)
/polox/prod/jwt/secret (SecureString)
/polox/prod/encryption/key (SecureString)

/polox/aws/region, /polox/aws/s3/bucket-dev, /polox/aws/s3/bucket-prod
```

### 3) Recuperar senha específica (com descriptografia)
```bash
# Produção - Senha do banco
aws ssm get-parameter --name '/polox/prod/db/password' --with-decryption --region sa-east-1

# Sandbox - JWT Secret  
aws ssm get-parameter --name '/polox/sandbox/jwt/secret' --with-decryption --region sa-east-1

# Dev - Host do banco
aws ssm get-parameter --name '/polox/dev/db/host' --region sa-east-1
```

### 4) Recuperar TODOS os parâmetros de um ambiente
```bash
# Produção (com descriptografia)
aws ssm get-parameters-by-path --path "/polox/prod" --recursive --with-decryption --region sa-east-1

# Sandbox (só metadados)
aws ssm get-parameters-by-path --path "/polox/sandbox" --recursive --region sa-east-1
```

---

## 🔧 **SCRIPTS NODE.JS DO PROJETO**

### 5) Testar carregamento de credenciais
```bash
# Carrega e testa credenciais de todos os ambientes
node scripts/load-secrets-from-ssm.js
```

**Saída esperada:**
```
🔐 Carregando secrets para ambiente: prod
✅ Carregados 7 parâmetros
📊 Config de produção carregada: { 
  host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  database: 'app_polox_prod', 
  user: 'polox_prod_user', 
  password: '***hidden***' 
}
🔑 JWT Secret carregado: jwt_secret...
🔧 Secrets de DEV: [ 'db', 'encryption', 'jwt' ]
```

### 6) Executar migração usando AWS SSM (Seguro)
```bash
# Exemplo: executar migração essencial em produção
NODE_ENV=prod node -e "
const { getDatabaseConfig } = require('./scripts/load-secrets-from-ssm');
const MigrationRunner = require('./migrations/migration-runner');
(async () => {
  console.log('🔄 Executando migração segura usando AWS SSM...');
  const config = await getDatabaseConfig('prod');
  const runner = new (class extends MigrationRunner {
    constructor() { 
      super(); 
      this.pool.end(); 
      const { Pool } = require('pg'); 
      this.pool = new Pool(config); 
    }
  })();
  await runner.createMigrationsTable();
  await runner.executeMigration('005_add_essential_tables.js');
  await runner.close();
  console.log('✅ Migração concluída!');
})();
"
```

---

## 📋 **REFERÊNCIA RÁPIDA**

### Status Atual dos Ambientes (21/10/2025):
| Ambiente | Status | Tabelas | Migrações | Host |
|----------|--------|---------|-----------|------|
| **DEV** | ✅ OK | 23 | 5 | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com |
| **SANDBOX** | ✅ OK | 13 | 2 | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com |
| **PROD** | ✅ OK | 13 | 2 | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com |

### Parâmetros por Ambiente:
- **DEV**: 6 parâmetros (db + jwt + encryption)
- **SANDBOX**: 5 parâmetros (db + jwt)  
- **PROD**: 7 parâmetros (db + proxy-host + jwt + encryption)
- **AWS Global**: 3 parâmetros (region + s3 buckets)

### Comandos Mais Usados:
```bash
# 1. Teste completo
node scripts/test-ssm-migrations.js

# 2. Listar parâmetros  
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1

# 3. Senha específica
aws ssm get-parameter --name '/polox/prod/db/password' --with-decryption --region sa-east-1
```

---

## Dicas rápidas
- Se não encontrar parâmetros, verifique a região e o perfil do AWS CLI.
- Use `aws configure --profile <profile>` para alternar credenciais.
- Para uso em scripts, recupere apenas os parâmetros necessários (evite imprimir segredos em logs).

---

## Segurança
- Nunca commite valores de secrets no código. Use `SecureString` e `--with-decryption` apenas quando necessário.
- Controle o acesso através de políticas IAM minimalistas.

---

Arquivo gerado automaticamente por processo de consolidação de documentação (21/10/2025).