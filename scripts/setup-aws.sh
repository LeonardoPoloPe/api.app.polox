#!/bin/bash
# Script para configurar AWS CLI
# Execute este script após inserir suas credenciais reais

echo "🔑 Configurando AWS CLI..."
echo ""
echo "⚠️  ATENÇÃO: Você precisa substituir os valores abaixo pelas suas credenciais reais!"
echo "📋 Consulte o arquivo docs/.naocompartilhar para as credenciais corretas"
echo ""

read -p "Digite seu AWS Access Key ID: " ACCESS_KEY
read -s -p "Digite seu AWS Secret Access Key: " SECRET_KEY
echo ""

if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
    echo "❌ Credenciais não podem estar vazias!"
    exit 1
fi

# Configurar AWS CLI
aws configure set aws_access_key_id "$ACCESS_KEY"
aws configure set aws_secret_access_key "$SECRET_KEY"
aws configure set default.region sa-east-1
aws configure set default.output json

# Testar configuração
echo ""
echo "🧪 Testando configuração..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo "✅ AWS CLI configurado com sucesso!"
    aws sts get-caller-identity
else
    echo "❌ Erro na configuração. Verifique suas credenciais."
    exit 1
fi