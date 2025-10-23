# Script para baixar certificados SSL da AWS
# Executar durante o deploy ou setup do projeto

Write-Host "Baixando certificados SSL da AWS..." -ForegroundColor Cyan

# Diretorio para certificados
$SSL_DIR = "src\config\ssl"
if (!(Test-Path $SSL_DIR)) {
    New-Item -ItemType Directory -Path $SSL_DIR -Force | Out-Null
}

# URL do certificado CA da AWS para RDS
$CERT_URL = "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
$CERT_FILE = "$SSL_DIR\rds-ca-2019-root.pem"

# Baixar certificado se nao existir
if (!(Test-Path $CERT_FILE)) {
    Write-Host "Baixando certificado CA da AWS..." -ForegroundColor Yellow
    
    try {
        Invoke-WebRequest -Uri $CERT_URL -OutFile $CERT_FILE -UseBasicParsing
        Write-Host "Certificado baixado com sucesso: $CERT_FILE" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao baixar certificado: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "Certificado ja existe: $CERT_FILE" -ForegroundColor Green
}

# Verificar se o arquivo foi criado e tem conteudo
if ((Test-Path $CERT_FILE) -and ((Get-Item $CERT_FILE).Length -gt 0)) {
    Write-Host "Certificado valido (arquivo criado com sucesso)" -ForegroundColor Green
    
    # Mostrar informacoes basicas do arquivo
    $fileInfo = Get-Item $CERT_FILE
    Write-Host "Informacoes do arquivo:" -ForegroundColor Cyan
    Write-Host "   Tamanho: $($fileInfo.Length) bytes" -ForegroundColor White
    Write-Host "   Criado em: $($fileInfo.CreationTime)" -ForegroundColor White
}
else {
    Write-Host "Certificado invalido ou vazio" -ForegroundColor Red
    if (Test-Path $CERT_FILE) {
        Remove-Item $CERT_FILE -Force
    }
    exit 1
}

Write-Host "Setup SSL concluido com sucesso!" -ForegroundColor Green