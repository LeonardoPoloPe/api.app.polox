# Polox API - Serverless Node.js API for AWS Lambda

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://postgresql.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange.svg)](https://aws.amazon.com/lambda/)
[![Serverless](https://img.shields.io/badge/Serverless-Framework-red.svg)](https://serverless.com/)

**✨ Last Update: October 25, 2025** - Multi-language support implemented

Serverless REST API built with Node.js, Express, PostgreSQL RDS and AWS Lambda, following clean architecture patterns and security best practices.

## 🌐 **Multi-Language Support**

This API supports **Portuguese**, **English**, and **Spanish**:

```bash
# English responses
curl -H "Accept-Language: en" https://api-url/health

# Portuguese responses (default)
curl -H "Accept-Language: pt" https://api-url/health

# Spanish responses
curl -H "Accept-Language: es" https://api-url/health
```

## 🌐 **Available Environments**

| Environment    | Base URL                                                          | Status    | Documentation |
| -------------- | ----------------------------------------------------------------- | --------- | ------------- |
| **🔧 DEV**     | `https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/`     | ✅ Active | `/api/docs`   |
| **🧪 SANDBOX** | `https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/` | ✅ Active | `/api/docs`   |
| **🚀 PROD**    | `https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/`    | ✅ Active | `/api/docs`   |

### 🎯 **Quick Start - Test API**

```bash
# Health Check (English)
curl -H "Accept-Language: en" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health

# Swagger Documentation
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/docs

# API Info (English)
curl -H "Accept-Language: en" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/

# Language Information
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/languages
```

## ⚡ **Quick Deploy**

### 🚀 **For Immediate Deploy:**

```bash
# 1. Install dependencies
npm install

# 2. Configure AWS credentials (if needed)
aws configure

# 3. Deploy to development
npm run deploy:dev

# 4. Test if it worked
curl -H "Accept-Language: en" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health
```

### 📦 **Deploy to Other Environments:**

```bash
# Sandbox environment
npm run deploy:sandbox

# Production environment
npm run deploy:prod
```

## 🏗️ **Architecture**

### **Technologies**

- **Runtime**: Node.js 18.x
- **Framework**: Express.js with i18next
- **Database**: PostgreSQL with RDS
- **Deploy**: AWS Lambda via Serverless Framework
- **Languages**: Portuguese, English, Spanish
- **SSL**: AWS Root Certificates

### **i18n Features**

- ✅ **API Response Translation** - All responses in user's language
- ✅ **Date Formatting** - Localized date formats (DD/MM/YYYY vs MM/DD/YYYY)
- ✅ **Currency Formatting** - BRL (R$), USD ($), EUR (€)
- ✅ **Error Messages** - Translated validation and error messages
- ✅ **Language Detection** - Header, query, cookie, body support

## 🗂️ **Project Structure**

```
api.app.polox/
├── src/
│   ├── handler.js              # Lambda Entry Point
│   ├── routes.js               # Route Definitions
│   ├── config/
│   │   ├── i18n.js             # Internationalization Config
│   │   ├── swagger.js          # Swagger Configuration
│   │   └── ssl-config.js       # SSL/TLS Configuration
│   ├── locales/                # Translation Files
│   │   ├── pt/common.json      # Portuguese
│   │   ├── en/common.json      # English
│   │   └── es/common.json      # Spanish
│   ├── controllers/            # API Controllers
│   ├── models/
│   │   ├── database.js         # DB Connection with RDS Proxy logic
│   │   └── User.js             # User Model
│   ├── services/               # Service Layer
│   └── utils/
│       ├── formatters-i18n.js  # Multi-language Formatters
│       └── response-helpers.js # i18n Response Helpers
├── migrations/                 # PostgreSQL Migrations
├── docs/                       # Multi-language Documentation
│   ├── pt/                     # Portuguese docs
│   ├── en/                     # English docs
│   └── es/                     # Spanish docs
├── serverless.yml              # Serverless Framework Config
└── package.json                # Dependencies
```

## 🔧 **Lambda Configuration**

### **Current Specifications:**

- **Memory**: 1024 MB
- **Timeout**: 60 seconds
- **Runtime**: nodejs18.x
- **Region**: sa-east-1
- **Languages**: Portuguese (default), English, Spanish

### **Environment Variables:**

```yaml
NODE_ENV: dev|sandbox|prod
DB_HOST: database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PROXY_HOST: polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT: 5432
DB_NAME: app_polox_{stage}
DB_USER: polox_{stage}_user
DB_PASSWORD: [CONFIGURED VIA AWS SSM]
SKIP_MIGRATIONS: true
```

## 🗄️ **Database**

### **RDS Configuration:**

- **Engine**: PostgreSQL
- **Host**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Proxy Host**: `polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`

### **Multi-language Support:**

- Users table: `language` field (pt-BR, en, es)
- Companies table: `language` field for default language
- Notification templates: Multi-language support

### **Databases by Environment:**

- **DEV**: `app_polox_dev` (direct connection)
- **SANDBOX**: `app_polox_sandbox` (direct connection)
- **PROD**: `app_polox_prod` (via RDS Proxy)

## 🚀 **Deploy Commands**

### **Build:**

```bash
npm run build
# or
serverless package
```

### **Deploy by Environment:**

#### **DEV:**

```bash
npm run deploy:dev
# or
serverless deploy --stage dev
```

#### **SANDBOX:**

```bash
npm run deploy:sandbox
# or
serverless deploy --stage sandbox
```

#### **PRODUCTION:**

```bash
npm run deploy:prod
# or
serverless deploy --stage prod
```

### **Remove Deployment:**

```bash
npm run remove:dev     # Remove dev environment
npm run remove:sandbox # Remove sandbox environment
npm run remove:prod    # Remove production environment
```

## 🔒 **Security**

### **Implemented:**

- ✅ **Helmet.js** - Security headers
- ✅ **CORS** - Cross-origin resource sharing
- ✅ **SSL/TLS** - AWS Root Certificates
- ✅ **RDS Proxy** - Connection pooling and security (PROD)
- ✅ **Input Validation** - Request validation
- ✅ **Error Handling** - Sanitized error responses

### **Environment Variables:**

All sensitive data is stored in AWS SSM Parameter Store, never in code.

## 📊 **Monitoring**

### **Implemented:**

- ✅ **CloudWatch Logs** - Lambda logs
- ✅ **Sentry Integration** - Error tracking
- ✅ **Health Check Endpoint** - `/health`
- ✅ **Request Logging** - Detailed request/response logs

### **Health Check:**

```bash
# Multi-language health check
curl -H "Accept-Language: en" https://api-url/health

Response:
{
  "success": true,
  "message": "API Status",
  "data": {
    "status": "Healthy",
    "timestamp": "2025-10-25T18:30:00.000Z",
    "environment": "Environment: dev",
    "database": "Database connected",
    "language": {
      "current": "en",
      "supported": ["pt", "en", "es"]
    },
    "version": "1.0.0"
  }
}
```

## 🧪 **Testing**

### **Test Commands:**

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### **Local Development:**

```bash
npm run dev           # Serverless offline
npm run dev:local     # Local Express server
```

## 📚 **API Examples**

### **English API Usage:**

```bash
# Get user info in English
curl -H "Accept-Language: en" \
     -H "Authorization: Bearer token" \
     https://api-url/api/users/me

# Create user with English responses
curl -X POST \
     -H "Accept-Language: en" \
     -H "Content-Type: application/json" \
     -d '{"name":"John","email":"john@example.com","language":"en"}' \
     https://api-url/api/users

# Get formatted data in English locale
curl -H "Accept-Language: en" \
     https://api-url/api/reports/financial
```

### **Response Format:**

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "user": {
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "10/25/2025 03:30:00 PM",
      "balance": "$1,000.00"
    }
  },
  "meta": {
    "timestamp": "2025-10-25T18:30:00.000Z",
    "language": "en"
  }
}
```

## 🌍 **Language Support**

### **Supported Languages:**

- 🇧🇷 **Portuguese (pt)** - Default
- 🇺🇸 **English (en)**
- 🇪🇸 **Spanish (es)**

### **Language Detection Order:**

1. HTTP Header: `Accept-Language`
2. Query Parameter: `?lang=en`
3. Cookie: `language=en`
4. Request Body: `{"language": "en"}`
5. Default: Portuguese

### **Date Formats:**

- Portuguese: `25/10/2025`
- English: `10/25/2025`
- Spanish: `25/10/2025`

### **Currency Formats:**

- Portuguese: `R$ 1.000,00`
- English: `$1,000.00`
- Spanish: `€1.000,00`

## 🔗 **Useful Links**

- [Portuguese Documentation](../pt/README.md)
- [Spanish Documentation](../es/README.md)
- [API Documentation](./API.md)
- [Setup Guide](./SETUP.md)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Serverless Framework](https://www.serverless.com/framework/docs/)

## 🆘 **Support**

For questions or issues:

1. Check the documentation in your language
2. Review the API examples
3. Test with different language headers
4. Check CloudWatch logs for debugging
