# 📚 Índice da Documentação - API Polox

_Última atualização: 21/10/2025_

---

## 🚀 **Documentação Principal**

### 📋 **Setup e Deploy**

- [📖 README.md](./README.md) - Visão geral e quick start
- [⚡ COMANDOS_DEPLOY.md](./COMANDOS_DEPLOY.md) - Comandos de deploy atualizados (Serverless Framework)
- [🔧 AWS_SETUP_INSTRUCTIONS.md](./AWS_SETUP_INSTRUCTIONS.md) - Configuração AWS
- [📊 ATUALIZACAO_21_10_2025.md](./ATUALIZACAO_21_10_2025.md) - **LOG DE MUDANÇAS RECENTES**

### 🔐 **Segurança** ✅ **IMPLEMENTADO COM SUCESSO**

- [🔐 POLITICAS_SEGURANCA_CREDENCIAIS.md](./POLITICAS_SEGURANCA_CREDENCIAIS.md) - **✅ Políticas implementadas - ZERO credenciais expostas (LEITURA OBRIGATÓRIA)**

### 🏗️ **Arquitetura**

- [📋 resumo-estrutura-v02.md](./resumo-estrutura-v02.md) - Resumo técnico completo
- [🏢 ESTRUTURA_PROJETO.md](./ESTRUTURA_PROJETO.md) - Organização de arquivos
- [🔗 STATUS_RDS_PROXY.md](./STATUS_RDS_PROXY.md) - Configuração de banco

### 📖 **Desenvolvimento**

- [📝 SWAGGER.md](./SWAGGER.md) - Documentação da API
- [🔄 tutorial-migrations.md](./tutorial-migrations.md) - Sistema de migrations
- [🧪 TESTES_INTERNOS.md](./TESTES_INTERNOS.md) - Testes e validação

### 🛠️ **Operações**

- [💻 COMANDOS_EXECUTIVOS.md](./COMANDOS_EXECUTIVOS.md) - Comandos operacionais
- [🔍 CONSULTA_PARAMETROS_AWS.md](./CONSULTA_PARAMETROS_AWS.md) - Parâmetros AWS
- [🗑️ CLEANUP_PLAN.md](./CLEANUP_PLAN.md) - Plano de limpeza
- [❌ ISSUES_SOLUCOES.md](./ISSUES_SOLUCOES.md) - Problemas e soluções

---

## 🌐 **Ambientes Ativos (21/10/2025)**

| Ambiente    | URL                                                                     | Swagger                                                                         | Health                                                                          |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **DEV**     | [Base](https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/)     | [Docs](https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/docs)     | [Health](https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health)     |
| **SANDBOX** | [Base](https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/) | [Docs](https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/docs) | [Health](https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/health) |
| **PROD**    | [Base](https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/)    | [Docs](https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api/docs)    | [Health](https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/health)    |

---

## ⚡ **Quick Actions**

### 🚀 **Deploy Rápido**

```bash
# Deploy desenvolvimento
npm run deploy:dev

# Deploy todos os ambientes
npm run deploy:dev && npm run deploy:sandbox && npm run deploy:prod
```

### 📊 **Logs**

```bash
# Logs em tempo real
npm run logs:dev

# Logs específicos
serverless logs -f api --stage dev --region sa-east-1 --startTime 5m
```

### 🧪 **Testes**

```bash
# Health check todos os ambientes
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health
curl https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/health
curl https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/health
```

---

## 🆕 **Principais Mudanças 21/10/2025**

✅ **Migração para Serverless Framework v3.40.0**  
✅ **Novos endpoints AWS Lambda (URLs atualizadas)**  
✅ **Correção de dependências Redis**  
✅ **Otimização de package size (~43 MB)**  
✅ **Configuração SKIP_MIGRATIONS para Lambda**  
✅ **Documentação de troubleshooting atualizada**

📋 **[Ver detalhes completos](./ATUALIZACAO_21_10_2025.md)**

---

## 🔍 **Navegação Rápida**

### Para Desenvolvedores:

- [Setup Inicial](./README.md#-deploy-rápido)
- [Comandos de Deploy](./COMANDOS_DEPLOY.md#-comandos-de-deploy)
- [Migrations](./tutorial-migrations.md)
- [Troubleshooting](./ATUALIZACAO_21_10_2025.md#-troubleshooting-comum)

### Para DevOps:

- [Configuração AWS](./AWS_SETUP_INSTRUCTIONS.md)
- [Status dos Serviços](./STATUS_RDS_PROXY.md)
- [Limpeza de Recursos](./CLEANUP_PLAN.md)
- [Logs e Monitoramento](./COMANDOS_DEPLOY.md#-logs-e-debugging)

### Para Product Managers:

- [Resumo Técnico](./resumo-estrutura-v02.md)
- [APIs Disponíveis](./SWAGGER.md)
- [Estrutura do Projeto](./ESTRUTURA_PROJETO.md)

---

_Documentação mantida por: GitHub Copilot & Leonardo Polo_
