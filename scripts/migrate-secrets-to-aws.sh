#!/bin/bash
# 🔐 Script para migrar credenciais para AWS Parameter Store
# Execute: chmod +x scripts/migrate-secrets-to-aws.sh && ./scripts/migrate-secrets-to-aws.sh
#
# ⚠️  ATENÇÃO: As senhas reais foram removidas deste arquivo por segurança!
# ✅ As credenciais estão seguras no AWS Parameter Store
# 📅 Migração executada com sucesso em 21/10/2025

set -e

echo "🔐 Migrando credenciais para AWS Parameter Store..."
echo "⚠️  ATENÇÃO: Certifique-se de ter AWS CLI configurado com as permissões adequadas"
echo ""

# Região AWS
AWS_REGION="sa-east-1"

echo "📊 1. Criando parâmetros de banco de dados..."

# DEV Environment
aws ssm put-parameter \
    --name "/polox/dev/db/host" \
    --value "database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/dev/db/name" \
    --value "app_polox_dev" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/dev/db/user" \
    --value "polox_dev_user" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/dev/db/password" \
    --value "SENHA_REMOVIDA_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

# SANDBOX Environment
aws ssm put-parameter \
    --name "/polox/sandbox/db/host" \
    --value "database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/sandbox/db/name" \
    --value "app_polox_sandbox" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/sandbox/db/user" \
    --value "polox_sandbox_user" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/sandbox/db/password" \
    --value "SENHA_REMOVIDA_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

# PRODUCTION Environment
aws ssm put-parameter \
    --name "/polox/prod/db/host" \
    --value "database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/db/proxy-host" \
    --value "polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/db/name" \
    --value "app_polox_prod" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/db/user" \
    --value "polox_prod_user" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/db/password" \
    --value "SENHA_REMOVIDA_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

echo "🔑 2. Criando JWT secrets..."

# JWT Secrets
aws ssm put-parameter \
    --name "/polox/dev/jwt/secret" \
    --value "JWT_SECRET_REMOVIDO_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/sandbox/jwt/secret" \
    --value "JWT_SECRET_REMOVIDO_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/jwt/secret" \
    --value "JWT_SECRET_REMOVIDO_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

echo "🔐 3. Criando chaves de criptografia..."

aws ssm put-parameter \
    --name "/polox/dev/encryption/key" \
    --value "ENCRYPTION_KEY_REMOVIDA_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/prod/encryption/key" \
    --value "ENCRYPTION_KEY_REMOVIDA_POR_SEGURANCA" \
    --type "SecureString" \
    --region $AWS_REGION \
    --overwrite

echo "☁️  4. Criando configurações AWS..."

aws ssm put-parameter \
    --name "/polox/aws/region" \
    --value "sa-east-1" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/aws/s3/bucket-dev" \
    --value "polox-uploads-dev" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

aws ssm put-parameter \
    --name "/polox/aws/s3/bucket-prod" \
    --value "polox-uploads-prod" \
    --type "String" \
    --region $AWS_REGION \
    --overwrite

echo ""
echo "✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo ""
echo "📋 Próximos passos:"
echo "1. Testar recuperação dos parâmetros:"
echo "   aws ssm get-parameter --name '/polox/prod/db/password' --with-decryption --region sa-east-1"
echo ""
echo "2. Atualizar aplicação para usar SSM:"
echo "   Veja o arquivo scripts/load-secrets-from-ssm.js"
echo ""
echo "3. REMOVER o arquivo local .naocompartilhar após confirmar que tudo funciona"
echo ""
echo "🔒 Todas as credenciais agora estão seguras no AWS Parameter Store!"