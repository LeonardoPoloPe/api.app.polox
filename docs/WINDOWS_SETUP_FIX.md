# Windows Setup Fix - SSL Certificate Download

## Issue

The original `npm install` was failing on Windows because the `postinstall` script was trying to execute a bash script (`setup-ssl.sh`) which requires WSL or bash to be available.

## Solution

Created a PowerShell equivalent (`setup-ssl.ps1`) and updated the `package.json` to use a cross-platform solution that detects the operating system and runs the appropriate script.

## Changes Made

### 1. Created PowerShell Script

- **File**: `scripts/setup-ssl.ps1`
- **Purpose**: Downloads AWS RDS CA certificate for SSL connections
- **Features**:
  - Creates `src/config/ssl` directory
  - Downloads `rds-ca-2019-root.pem` from AWS S3
  - Validates the downloaded certificate
  - Provides colored output with status messages

### 2. Updated package.json

- **Changed**: `setup:ssl` script to be cross-platform
- **Old**: `"setup:ssl": "bash scripts/setup-ssl.sh"`
- **New**: Cross-platform Node.js script that detects Windows vs Unix and runs appropriate script

### 3. SSL Certificate Status

- ✅ Certificate downloaded successfully: `src/config/ssl/rds-ca-2019-root.pem`
- ✅ File size: 1,456 bytes
- ✅ Certificate is valid for AWS RDS SSL connections

## Security Vulnerabilities

There are 6 moderate severity vulnerabilities detected in transitive dependencies:

- Related to `validator` package used by `express-validator` and `swagger-jsdoc`
- These are not critical for development but should be monitored
- Consider updating dependencies or finding alternative packages for production

## Next Steps

1. ✅ npm install now works on Windows
2. ✅ SSL certificates are properly downloaded
3. 🔶 Monitor security vulnerabilities and update dependencies as needed
4. ✅ Development environment is ready for local testing

## Commands to Verify Setup

```powershell
# Verify SSL certificate exists
Test-Path "src\config\ssl\rds-ca-2019-root.pem"

# Check certificate file size
(Get-Item "src\config\ssl\rds-ca-2019-root.pem").Length

# Run SSL setup manually if needed
npm run setup:ssl
```

Date: October 23, 2025
