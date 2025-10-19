# 🧪 Testes Internos - API Polox

> **🔒 SEGURANÇA ATUALIZADA**: As credenciais foram removidas dos arquivos de teste.
> Use variáveis de ambiente para configurar as conexões com segurança.

## 📋 Scripts de Teste Disponíveis

### 🔧 Testes de Conexão de Banco

| Arquivo                    | Descrição                        | Comando                                         |
| -------------------------- | -------------------------------- | ----------------------------------------------- |
| `test-db-connection.js`    | Testa conexão com banco DEV      | `node testes-internos/test-db-connection.js`    |
| `test-db-sandbox.js`       | Testa conexão com banco SANDBOX  | `node testes-internos/test-db-sandbox.js`       |
| `test-db-prod.js`          | Testa conexão com banco PRODUÇÃO | `node testes-internos/test-db-prod.js`          |
| `test-all-environments.js` | **Testa TODOS os ambientes**     | `node testes-internos/test-all-environments.js` |

### 🎯 Teste Recomendado

Execute o teste completo para verificar todos os ambientes:

```bash
node testes-internos/test-all-environments.js
```

Este comando irá:

- ✅ Testar conexão com PostgreSQL RDS
- ✅ Verificar credenciais de cada ambiente
- ✅ Criar tabelas de teste
- ✅ Inserir e consultar dados
- ✅ Mostrar relatório completo

## 🔒 Segurança

### Configuração das Credenciais:

Para executar os testes, configure as variáveis de ambiente:

```bash
# Desenvolvimento
DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=app_polox_dev
DB_USER=polox_dev_user
DB_PASSWORD=[CONFIGURADO VIA AWS SSM]
```

⚠️ **IMPORTANTE**:

- **Consulte** `docs/.naocompartilhar` para as credenciais corretas
- **Nunca** hardcode senhas nos arquivos de teste
- **Use** variáveis de ambiente para configuração segura

## 📝 Como Adicionar Novos Testes

### REGRA BÁSICA:

> **Todos os arquivos de teste devem ficar nesta pasta `testes-internos/`**

1. Crie o arquivo de teste nesta pasta
2. Use o prefixo `test-` no nome do arquivo
3. Nunca commite esta pasta no Git
4. Documente o teste no README principal

### Exemplo de Estrutura:

```javascript
// testes-internos/test-minha-funcionalidade.js
const { Pool } = require("pg");

// Seu código de teste aqui
console.log("🧪 Testando minha funcionalidade...");

// Sempre termine com exit code apropriado
process.exit(0); // sucesso
// process.exit(1); // falha
```

## 🚫 O que NÃO fazer

❌ Não commitar esta pasta no Git  
❌ Não expor credenciais em logs públicos  
❌ Não usar dados de produção em testes  
❌ Não deixar processos rodando após testes

## ✅ Boas Práticas

✅ Sempre feche conexões após testes  
✅ Use timeouts apropriados  
✅ Trate erros adequadamente  
✅ Documente novos testes  
✅ Use dados de teste isolados
