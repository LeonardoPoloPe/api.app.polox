# 🚀 Processo de Deploy - Polo X API

## ⚠️ Deploy Manual em Produção

Este projeto **NÃO utiliza deploy automático**. Todo deploy é feito manualmente no servidor Ubuntu.

### ❌ Removido:

- ❌ AWS Lambda / Serverless
- ❌ AWS RDS
- ❌ AWS Secrets Manager
- ❌ GitHub Actions auto-deploy
- ❌ CI/CD automático

### ✅ Processo Atual:

**Infraestrutura:**

- 🐳 Docker + Docker Compose
- 🔀 Traefik (reverse proxy + SSL)
- 🐘 PostgreSQL 17 self-hosted (porta 5434)
- 🖥️ Ubuntu Server (72.62.12.101)

**Fluxo de Deploy:**

1. **Desenvolvimento Local** (Windows):

   ```powershell
   npm run dev:local
   ```

2. **Commit & Push**:

   ```bash
   git add .
   git commit -m "feat: nova funcionalidade"
   git push origin main
   ```

3. **Deploy Manual no Servidor**:

   ```bash
   # SSH no servidor
   ssh root@72.62.12.101

   # Ir para o diretório
   cd /root/polox-api

   # Puxar alterações
   git pull origin main

   # Rodar deploy
   ./deploy-prod.sh
   ```

4. **Verificar**:

   ```bash
   # Health check
   curl https://api.polox.com.br/health

   # Logs
   docker logs -f polox-api-prod
   ```

## 📝 Guia Completo

Ver [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md) para instruções detalhadas.

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento local (sem Docker)
npm run dev:local

# Build Docker local
docker build -t polox-api:latest .

# Deploy em produção (no servidor)
./deploy-prod.sh

# Ver logs
docker logs -f polox-api-prod

# Restart
docker restart polox-api-prod

# Rodar migrations
docker exec polox-api-prod node migrations/migration-runner.js up
```

## 🔄 GitHub Actions

O workflow `.github/workflows/migrations-test.yml` está **DESABILITADO**.

Para reativar (se necessário no futuro):

1. Descomentar o arquivo
2. Configurar secrets no GitHub
3. Ajustar para nova infraestrutura

## 📊 Ambientes

| Ambiente        | Como Rodar          | Onde            |
| --------------- | ------------------- | --------------- |
| **Development** | `npm run dev:local` | Local (Windows) |
| **Production**  | `./deploy-prod.sh`  | Servidor Ubuntu |

## 🌐 URLs de Produção

- **API**: https://api.polox.com.br
- **Health**: https://api.polox.com.br/health
- **Swagger**: https://api.polox.com.br/api/v1/docs

## 📦 Estrutura no Servidor

```
/root/polox-api/
├── .env.production       # Variáveis de ambiente
├── docker-compose.prod.yml
├── deploy-prod.sh        # Script de deploy
└── ...
```

## ✅ Checklist de Deploy

- [ ] Código commitado e pushed para `main`
- [ ] SSH no servidor
- [ ] `git pull origin main`
- [ ] `./deploy-prod.sh`
- [ ] Verificar health check
- [ ] Testar endpoints principais
- [ ] Verificar logs

## 🚨 Rollback

Se algo der errado:

```bash
# Voltar para versão anterior
git checkout HEAD~1
./deploy-prod.sh

# Ou parar container
docker-compose -f docker-compose.prod.yml down
```

---

**Última atualização**: Janeiro 2026  
**Tipo de Deploy**: Manual  
**Responsável**: Equipe Polo X
