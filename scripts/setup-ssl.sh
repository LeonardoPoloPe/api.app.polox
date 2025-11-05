#!/bin/bash
# Bash script to setup SSL certificates for AWS RDS connection
# Compatible with macOS and Linux environments

echo -e "\033[0;32m[SSL] Setting up SSL certificates for AWS RDS...\033[0m"

# Define paths
SSL_DIR="src/config/ssl"
CERT_FILE="$SSL_DIR/rds-ca-2019-root.pem"

# Check if SSL directory exists
if [ ! -d "$SSL_DIR" ]; then
    echo -e "\033[0;33m[SSL] Creating SSL directory: $SSL_DIR\033[0m"
    mkdir -p "$SSL_DIR"
else
    echo -e "\033[0;32m[SSL] SSL directory already exists: $SSL_DIR\033[0m"
fi

# Check if certificate already exists
if [ -f "$CERT_FILE" ]; then
    FILE_SIZE=$(wc -c < "$CERT_FILE")
    echo -e "\033[0;32m[SSL] SSL certificate already exists: $CERT_FILE ($FILE_SIZE bytes)\033[0m"
    
    # Verify certificate is not empty
    if [ "$FILE_SIZE" -gt 1000 ]; then
        echo -e "\033[0;32m[SSL] Certificate appears to be valid (size: $FILE_SIZE bytes)\033[0m"
        echo -e "\033[0;32m[SSL] SSL setup completed successfully!\033[0m"
        exit 0
    else
        echo -e "\033[0;33m[SSL] Certificate exists but appears to be invalid or corrupted\033[0m"
        echo -e "\033[0;33m[SSL] Re-downloading certificate...\033[0m"
    fi
else
    echo -e "\033[0;33m[SSL] Downloading AWS RDS CA certificate...\033[0m"
fi

# Download the certificate from AWS
CERT_URL="https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
ALT_URL="https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"

echo -e "\033[0;36m[SSL] Downloading from AWS: $ALT_URL\033[0m"

# Try to download using curl (preferred on macOS)
if command -v curl &> /dev/null; then
    if curl -f -s -o "$CERT_FILE" "$ALT_URL"; then
        DOWNLOADED_SIZE=$(wc -c < "$CERT_FILE")
        echo -e "\033[0;32m[SSL] Certificate downloaded successfully!\033[0m"
        echo -e "\033[0;32m[SSL] File size: $DOWNLOADED_SIZE bytes\033[0m"
        
        # Basic validation - check if file contains PEM markers
        if grep -q "BEGIN CERTIFICATE" "$CERT_FILE" && grep -q "END CERTIFICATE" "$CERT_FILE"; then
            echo -e "\033[0;32m[SSL] Certificate format appears valid (contains PEM markers)\033[0m"
        else
            echo -e "\033[0;33m[SSL] Warning: Certificate format might be incorrect\033[0m"
        fi
        
        echo -e "\033[0;32m[SSL] SSL setup completed successfully!\033[0m"
        echo -e "\033[0;32m[SSL] Your application can now connect securely to AWS RDS\033[0m"
    else
        echo -e "\033[0;31m[SSL] Failed to download certificate from primary URL\033[0m"
        echo -e "\033[0;33m[SSL] Trying alternative method...\033[0m"
        
        # Try with alternative URL
        echo -e "\033[0;36m[SSL] Trying alternative URL: $CERT_URL\033[0m"
        if curl -f -s -o "$CERT_FILE" "$CERT_URL"; then
            DOWNLOADED_SIZE=$(wc -c < "$CERT_FILE")
            echo -e "\033[0;32m[SSL] Certificate downloaded successfully using alternative method!\033[0m"
            echo -e "\033[0;32m[SSL] File size: $DOWNLOADED_SIZE bytes\033[0m"
        else
            echo -e "\033[0;31m[SSL] Error downloading SSL certificate\033[0m"
            echo -e "\033[0;33m[SSL] Please download manually from: $ALT_URL\033[0m"
            echo -e "\033[0;33m[SSL] Save as: $CERT_FILE\033[0m"
            exit 1
        fi
    fi
elif command -v wget &> /dev/null; then
    # Fallback to wget if curl is not available
    if wget -q -O "$CERT_FILE" "$ALT_URL"; then
        DOWNLOADED_SIZE=$(wc -c < "$CERT_FILE")
        echo -e "\033[0;32m[SSL] Certificate downloaded successfully!\033[0m"
        echo -e "\033[0;32m[SSL] File size: $DOWNLOADED_SIZE bytes\033[0m"
        
        # Basic validation - check if file contains PEM markers
        if grep -q "BEGIN CERTIFICATE" "$CERT_FILE" && grep -q "END CERTIFICATE" "$CERT_FILE"; then
            echo -e "\033[0;32m[SSL] Certificate format appears valid (contains PEM markers)\033[0m"
        else
            echo -e "\033[0;33m[SSL] Warning: Certificate format might be incorrect\033[0m"
        fi
        
        echo -e "\033[0;32m[SSL] SSL setup completed successfully!\033[0m"
        echo -e "\033[0;32m[SSL] Your application can now connect securely to AWS RDS\033[0m"
    else
        echo -e "\033[0;31m[SSL] Failed to download certificate\033[0m"
        echo -e "\033[0;33m[SSL] Please download manually from: $ALT_URL\033[0m"
        echo -e "\033[0;33m[SSL] Save as: $CERT_FILE\033[0m"
        exit 1
    fi
else
    echo -e "\033[0;31m[SSL] Error: Neither curl nor wget is available\033[0m"
    echo -e "\033[0;33m[SSL] Please install curl or wget, or download manually from: $ALT_URL\033[0m"
    echo -e "\033[0;33m[SSL] Save as: $CERT_FILE\033[0m"
    exit 1
fi

# Display summary
echo ""
echo -e "\033[0;36m[SSL] SSL Certificate Setup Summary:\033[0m"
echo -e "   Directory: $SSL_DIR"
echo -e "   Certificate: $CERT_FILE"
if [ -f "$CERT_FILE" ]; then
    FINAL_SIZE=$(wc -c < "$CERT_FILE")
    echo -e "   Size: $FINAL_SIZE bytes"
    echo -e "   \033[0;32mStatus: Ready for production SSL connections\033[0m"
else
    echo -e "   \033[0;31mStatus: Certificate missing - manual download required\033[0m"
fi
echo ""
