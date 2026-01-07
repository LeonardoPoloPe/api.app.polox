# 🚀 Deploy da API Polox em Produção

## 📋 Pré-requisitos no Servidor

✅ Docker e Docker Compose instalados  
✅ Traefik rodando na rede `proxy`  
✅ PostgreSQL rodando na porta 5434  
✅ DNS `api.polox.com.br` apontando para o servidor  
✅ Portas 80 e 443 abertas no firewall

## 📦 1. Preparar Ambiente

### 1.1 Clonar repositório no servidor

```bash
cd /root
git clone https://github.com/seu-usuario/api.app.polox.git polox-api
cd polox-api
```

### 1.2 Criar arquivo `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Configure as variáveis:

```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=172.17.0.1
DB_PORT=5434
DB_NAME=app_polox_prod
DB_USER=admin
DB_PASSWORD=SUA_SENHA_FORTE_AQUI

# JWT (GERAR SENHAS FORTES!)
JWT_SECRET=sua-chave-jwt-super-secreta-aqui
JWT_REFRESH_SECRET=sua-chave-refresh-super-secreta-aqui

# Swagger
ENABLE_SWAGGER=true

TZ=America/Sao_Paulo
```

### 1.3 Dar permissão ao script de deploy

```bash
chmod +x deploy-prod.sh
```

## 🚀 2. Deploy

### Opção 1: Script Automático (Recomendado)

```bash
./deploy-prod.sh
```

### Opção 2: Manual

```bash
# Build e subir
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

## ✅ 3. Verificar Deploy

### 3.1 Verificar se container está rodando

```bash
docker ps | grep polox-api
```

Deve mostrar:

```
CONTAINER ID   IMAGE           STATUS          PORTS     NAMES
xxxxx          polox-api:latest   Up X minutes              polox-api-prod
```

### 3.2 Testar Health Check

```bash
# Local (dentro do servidor)
curl http://localhost:3000/health

# Externo (via Traefik)
curl https://api.polox.com.br/health
```

Deve retornar:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

### 3.3 Ver logs

```bash
docker logs -f polox-api-prod
```

## 🔧 4. Comandos Úteis

```bash
# Ver logs em tempo real
docker logs -f polox-api-prod

# Acessar shell do container
docker exec -it polox-api-prod sh

# Rodar migrations
docker exec polox-api-prod node migrations/migration-runner.js up

# Restart do container
docker restart polox-api-prod

# Parar container
docker-compose -f docker-compose.prod.yml down

# Ver estatísticas (CPU, RAM)
docker stats polox-api-prod

# Ver informações do container
docker inspect polox-api-prod
```

## 🔄 5. Atualizar Aplicação

Quando houver alterações no código:

```bash
# Puxar alterações do git
git pull origin main

# Rodar script de deploy
./deploy-prod.sh
```

## 🌐 6. Endpoints Disponíveis

Após deploy bem-sucedido:

- 🏠 **Home**: https://api.polox.com.br/
- 💚 **Health**: https://api.polox.com.br/health
- 📚 **Swagger**: https://api.polox.com.br/api/v1/docs
- 👥 **Contacts**: https://api.polox.com.br/api/v1/contacts
- 🏢 **Companies**: https://api.polox.com.br/api/v1/companies

## 🔐 7. Segurança

### 7.1 Verificar Traefik

```bash
docker logs traefik | grep polox-api
```

### 7.2 Verificar Certificado SSL

```bash
curl -I https://api.polox.com.br
```

Deve ter `SSL certificate verify ok`

## 🐛 8. Troubleshooting

### Container não inicia

```bash
# Ver logs completos
docker logs polox-api-prod

# Verificar configuração
docker inspect polox-api-prod
```

### Não conecta no banco

```bash
# Testar conexão do container para o host
docker exec polox-api-prod ping -c 3 172.17.0.1

# Verificar se PostgreSQL aceita conexões do Docker
# No servidor host:
netstat -tulpn | grep 5434
```

### Traefik não roteia

```bash
# Ver logs do Traefik
docker logs traefik | tail -50

# Verificar rede proxy
docker network inspect proxy

# Verificar labels do container
docker inspect polox-api-prod | grep -A 30 Labels
```

### Health check falha

```bash
# Testar dentro do container
docker exec polox-api-prod curl http://localhost:3000/health

# Ver logs
docker logs polox-api-prod | grep health
```

## 📊 9. Monitoramento

### Ver uso de recursos

```bash
# CPU e memória
docker stats polox-api-prod --no-stream

# Logs com timestamp
docker logs --timestamps polox-api-prod
```

### Backup de logs

```bash
docker logs polox-api-prod > ~/backups/polox-api-$(date +%Y%m%d).log
```

## 🔙 10. Rollback

Se algo der errado:

```bash
# Parar container atual
docker-compose -f docker-compose.prod.yml down

# Usar versão anterior do código
git checkout HEAD~1

# Deploy da versão anterior
./deploy-prod.sh
```

## 📝 11. Estrutura de Arquivos no Servidor

```
/root/polox-api/
├── .env.production          # Variáveis de ambiente (NÃO COMMITAR!)
├── docker-compose.prod.yml  # Configuração Docker
├── Dockerfile               # Imagem da aplicação
├── deploy-prod.sh          # Script de deploy
├── src/                    # Código fonte
├── migrations/             # Migrations do banco
└── package.json            # Dependências Node.js
```

## ✅ Checklist de Deploy

- [ ] Servidor Ubuntu atualizado
- [ ] Docker e Docker Compose instalados
- [ ] Traefik rodando na rede `proxy`
- [ ] PostgreSQL rodando na porta 5434
- [ ] DNS configurado (api.polox.com.br)
- [ ] Firewall configurado (portas 80, 443)
- [ ] Repositório clonado
- [ ] `.env.production` criado e configurado
- [ ] Script de deploy executado
- [ ] Health check funcionando
- [ ] SSL funcionando
- [ ] Swagger acessível

## 📞 Suporte

Em caso de problemas:

1. Verificar logs: `docker logs -f polox-api-prod`
2. Verificar Traefik: `docker logs traefik`
3. Verificar PostgreSQL: `docker logs postgres-17-server`
4. Testar endpoints manualmente

---

**Última atualização**: Janeiro 2026  
**Versão**: 1.0.0
