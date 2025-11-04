# PowerShell script to setup SSL certificates for AWS RDS connection
# Compatible with Windows environments

Write-Host "[SSL] Setting up SSL certificates for AWS RDS..." -ForegroundColor Green

# Define paths
$sslDir = "src\config\ssl"
$certFile = "$sslDir\rds-ca-2019-root.pem"

# Check if SSL directory exists
if (-Not (Test-Path $sslDir)) {
    Write-Host "[SSL] Creating SSL directory: $sslDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
} else {
    Write-Host "[SSL] SSL directory already exists: $sslDir" -ForegroundColor Green
}

# Check if certificate already exists
if (Test-Path $certFile) {
    $fileSize = (Get-Item $certFile).Length
    Write-Host "[SSL] SSL certificate already exists: $certFile ($fileSize bytes)" -ForegroundColor Green
    
    # Verify certificate is not empty
    if ($fileSize -gt 1000) {
        Write-Host "[SSL] Certificate appears to be valid (size: $fileSize bytes)" -ForegroundColor Green
        Write-Host "[SSL] SSL setup completed successfully!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[SSL] Certificate exists but appears to be invalid or corrupted" -ForegroundColor Yellow
        Write-Host "[SSL] Re-downloading certificate..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[SSL] Downloading AWS RDS CA certificate..." -ForegroundColor Yellow
}

# Download the certificate from AWS
$certUrl = "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
$altUrl = "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"

try {
    Write-Host "[SSL] Downloading from AWS: $altUrl" -ForegroundColor Cyan
    
    # Use Invoke-WebRequest to download the certificate
    $progressPreference = 'SilentlyContinue' # Hide progress bar for cleaner output
    Invoke-WebRequest -Uri $altUrl -OutFile $certFile -UseBasicParsing
    
    # Verify download
    if (Test-Path $certFile) {
        $downloadedSize = (Get-Item $certFile).Length
        Write-Host "[SSL] Certificate downloaded successfully!" -ForegroundColor Green
        Write-Host "[SSL] File size: $downloadedSize bytes" -ForegroundColor Green
        
        # Basic validation - check if file is not empty and contains PEM markers
        $content = Get-Content $certFile -Raw
        if ($content -match "-----BEGIN CERTIFICATE-----" -and $content -match "-----END CERTIFICATE-----") {
            Write-Host "[SSL] Certificate format appears valid (contains PEM markers)" -ForegroundColor Green
        } else {
            Write-Host "[SSL] Warning: Certificate format might be incorrect" -ForegroundColor Yellow
        }
        
        Write-Host "[SSL] SSL setup completed successfully!" -ForegroundColor Green
        Write-Host "[SSL] Your application can now connect securely to AWS RDS" -ForegroundColor Green
        
    } else {
        throw "Certificate file was not created"
    }
    
} catch {
    Write-Host "[SSL] Failed to download certificate from primary URL" -ForegroundColor Red
    Write-Host "[SSL] Trying alternative method..." -ForegroundColor Yellow
    
    try {
        # Try with alternative URL or method
        Write-Host "[SSL] Trying alternative URL: $certUrl" -ForegroundColor Cyan
        Invoke-WebRequest -Uri $certUrl -OutFile $certFile -UseBasicParsing
        
        if (Test-Path $certFile) {
            $downloadedSize = (Get-Item $certFile).Length
            Write-Host "[SSL] Certificate downloaded successfully using alternative method!" -ForegroundColor Green
            Write-Host "[SSL] File size: $downloadedSize bytes" -ForegroundColor Green
        }
    } catch {
        Write-Host "[SSL] Error downloading SSL certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[SSL] Please download manually from: $altUrl" -ForegroundColor Yellow
        Write-Host "[SSL] Save as: $certFile" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "[SSL] SSL Certificate Setup Summary:" -ForegroundColor Cyan
Write-Host "   Directory: $sslDir" -ForegroundColor White
Write-Host "   Certificate: $certFile" -ForegroundColor White
if (Test-Path $certFile) {
    $finalSize = (Get-Item $certFile).Length
    Write-Host "   Size: $finalSize bytes" -ForegroundColor White
    Write-Host "   Status: Ready for production SSL connections" -ForegroundColor Green
} else {
    Write-Host "   Status: Certificate missing - manual download required" -ForegroundColor Red
}
Write-Host ""