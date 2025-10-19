#!/bin/bash

# Script para baixar certificados SSL da AWS
# Executar durante o deploy ou setup do projeto

set -e  # Parar em caso de erro

echo "🔒 Baixando certificados SSL da AWS..."

# Diretório para certificados
SSL_DIR="src/config/ssl"
mkdir -p $SSL_DIR

# URL do certificado CA da AWS para RDS
CERT_URL="https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
CERT_FILE="$SSL_DIR/rds-ca-2019-root.pem"

# Baixar certificado se não existir
if [ ! -f "$CERT_FILE" ]; then
    echo "📥 Baixando certificado CA da AWS..."
    curl -o "$CERT_FILE" "$CERT_URL"
    
    if [ $? -eq 0 ]; then
        echo "✅ Certificado baixado com sucesso: $CERT_FILE"
    else
        echo "❌ Erro ao baixar certificado"
        exit 1
    fi
else
    echo "✅ Certificado já existe: $CERT_FILE"
fi

# Verificar se o certificado é válido
if openssl x509 -in "$CERT_FILE" -text -noout > /dev/null 2>&1; then
    echo "✅ Certificado válido"
    
    # Mostrar informações do certificado
    echo "📋 Informações do certificado:"
    openssl x509 -in "$CERT_FILE" -subject -issuer -dates -noout
else
    echo "❌ Certificado inválido"
    rm -f "$CERT_FILE"
    exit 1
fi

echo "🎉 Setup SSL concluído com sucesso!"