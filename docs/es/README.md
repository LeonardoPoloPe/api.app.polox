# API Polox - API Serverless Node.js para AWS Lambda

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://postgresql.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange.svg)](https://aws.amazon.com/lambda/)
[![Serverless](https://img.shields.io/badge/Serverless-Framework-red.svg)](https://serverless.com/)

**✨ Última Actualización: 25 de octubre de 2025** - Soporte multi-idioma implementado

API REST serverless construida con Node.js, Express, PostgreSQL RDS y AWS Lambda, siguiendo patrones de arquitectura limpia y mejores prácticas de seguridad.

## 🌐 **Soporte Multi-Idioma**

Esta API soporta **Portugués**, **Inglés** y **Español**:

```bash
# Respuestas en español
curl -H "Accept-Language: es" https://api-url/health

# Respuestas en portugués (predeterminado)
curl -H "Accept-Language: pt" https://api-url/health

# Respuestas en inglés
curl -H "Accept-Language: en" https://api-url/health
```

## 🌐 **Ambientes Disponibles**

| Ambiente       | URL Base                                                          | Estado    | Documentación |
| -------------- | ----------------------------------------------------------------- | --------- | ------------- |
| **🔧 DEV**     | `https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/`     | ✅ Activo | `/api/docs`   |
| **🧪 SANDBOX** | `https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/` | ✅ Activo | `/api/docs`   |
| **🚀 PROD**    | `https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/`    | ✅ Activo | `/api/docs`   |

### 🎯 **Inicio Rápido - Probar API**

```bash
# Health Check (Español)
curl -H "Accept-Language: es" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health

# Documentación Swagger
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/docs

# Información de la API (Español)
curl -H "Accept-Language: es" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/

# Información de idiomas
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/languages
```

## ⚡ **Deploy Rápido**

### 🚀 **Para Deploy Inmediato:**

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar credenciales AWS (si es necesario)
aws configure

# 3. Deploy a desarrollo
npm run deploy:dev

# 4. Probar si funcionó
curl -H "Accept-Language: es" https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health
```

### 📦 **Deploy a Otros Ambientes:**

```bash
# Ambiente sandbox
npm run deploy:sandbox

# Ambiente producción
npm run deploy:prod
```

## 🏗️ **Arquitectura**

### **Tecnologías**

- **Runtime**: Node.js 18.x
- **Framework**: Express.js con i18next
- **Base de Datos**: PostgreSQL con RDS
- **Deploy**: AWS Lambda via Serverless Framework
- **Idiomas**: Portugués, Inglés, Español
- **SSL**: Certificados AWS Root

### **Características i18n**

- ✅ **Traducción de Respuestas API** - Todas las respuestas en el idioma del usuario
- ✅ **Formato de Fechas** - Formatos de fecha localizados (DD/MM/YYYY vs MM/DD/YYYY)
- ✅ **Formato de Moneda** - BRL (R$), USD ($), EUR (€)
- ✅ **Mensajes de Error** - Mensajes de validación y error traducidos
- ✅ **Detección de Idioma** - Soporte para header, query, cookie, body

## 🗂️ **Estructura del Proyecto**

```
api.app.polox/
├── src/
│   ├── handler.js              # Punto de Entrada Lambda
│   ├── routes.js               # Definiciones de Rutas
│   ├── config/
│   │   ├── i18n.js             # Configuración de Internacionalización
│   │   ├── swagger.js          # Configuración Swagger
│   │   └── ssl-config.js       # Configuración SSL/TLS
│   ├── locales/                # Archivos de Traducción
│   │   ├── pt/common.json      # Portugués
│   │   ├── en/common.json      # Inglés
│   │   └── es/common.json      # Español
│   ├── controllers/            # Controladores API
│   ├── models/
│   │   ├── database.js         # Conexión DB con lógica RDS Proxy
│   │   └── User.js             # Modelo Usuario
│   ├── services/               # Capa de Servicios
│   └── utils/
│       ├── formatters-i18n.js  # Formateadores Multi-idioma
│       └── response-helpers.js # Helpers de Respuesta i18n
├── migrations/                 # Migraciones PostgreSQL
├── docs/                       # Documentación Multi-idioma
│   ├── pt/                     # Docs en portugués
│   ├── en/                     # Docs en inglés
│   └── es/                     # Docs en español
├── serverless.yml              # Configuración Serverless Framework
└── package.json                # Dependencias
```

## 🔧 **Configuración Lambda**

### **Especificaciones Actuales:**

- **Memoria**: 1024 MB
- **Timeout**: 60 segundos
- **Runtime**: nodejs18.x
- **Región**: sa-east-1
- **Idiomas**: Portugués (predeterminado), Inglés, Español

### **Variables de Entorno:**

```yaml
NODE_ENV: dev|sandbox|prod
DB_HOST: database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PROXY_HOST: polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT: 5432
DB_NAME: app_polox_{stage}
DB_USER: polox_{stage}_user
DB_PASSWORD: [CONFIGURADO VIA AWS SSM]
SKIP_MIGRATIONS: true
```

## 🗄️ **Base de Datos**

### **Configuración RDS:**

- **Motor**: PostgreSQL
- **Host**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Proxy Host**: `polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`

### **Soporte Multi-idioma:**

- Tabla usuarios: campo `language` (pt-BR, en, es)
- Tabla empresas: campo `language` para idioma predeterminado
- Plantillas de notificación: Soporte multi-idioma

### **Bases de Datos por Ambiente:**

- **DEV**: `app_polox_dev` (conexión directa)
- **SANDBOX**: `app_polox_sandbox` (conexión directa)
- **PROD**: `app_polox_prod` (via RDS Proxy)

## 🚀 **Comandos de Deploy**

### **Build:**

```bash
npm run build
# o
serverless package
```

### **Deploy por Ambiente:**

#### **DEV:**

```bash
npm run deploy:dev
# o
serverless deploy --stage dev
```

#### **SANDBOX:**

```bash
npm run deploy:sandbox
# o
serverless deploy --stage sandbox
```

#### **PRODUCCIÓN:**

```bash
npm run deploy:prod
# o
serverless deploy --stage prod
```

### **Remover Deployment:**

```bash
npm run remove:dev     # Remover ambiente dev
npm run remove:sandbox # Remover ambiente sandbox
npm run remove:prod    # Remover ambiente producción
```

## 🔒 **Seguridad**

### **Implementado:**

- ✅ **Helmet.js** - Headers de seguridad
- ✅ **CORS** - Cross-origin resource sharing
- ✅ **SSL/TLS** - Certificados AWS Root
- ✅ **RDS Proxy** - Connection pooling y seguridad (PROD)
- ✅ **Validación de Input** - Validación de requests
- ✅ **Manejo de Errores** - Respuestas de error sanitizadas

### **Variables de Entorno:**

Todos los datos sensibles se almacenan en AWS SSM Parameter Store, nunca en código.

## 📊 **Monitoreo**

### **Implementado:**

- ✅ **CloudWatch Logs** - Logs de Lambda
- ✅ **Integración Sentry** - Seguimiento de errores
- ✅ **Health Check Endpoint** - `/health`
- ✅ **Logging de Requests** - Logs detallados de request/response

### **Health Check:**

```bash
# Health check multi-idioma
curl -H "Accept-Language: es" https://api-url/health

Respuesta:
{
  "success": true,
  "message": "Estado de la API",
  "data": {
    "status": "Saludable",
    "timestamp": "2025-10-25T18:30:00.000Z",
    "environment": "Ambiente: dev",
    "database": "Base de datos conectada",
    "language": {
      "current": "es",
      "supported": ["pt", "en", "es"]
    },
    "version": "1.0.0"
  }
}
```

## 🧪 **Testing**

### **Comandos de Test:**

```bash
npm test              # Ejecutar todos los tests
npm run test:watch    # Modo watch
npm run test:coverage # Reporte de cobertura
```

### **Desarrollo Local:**

```bash
npm run dev           # Serverless offline
npm run dev:local     # Servidor Express local
```

## 📚 **Ejemplos de API**

### **Uso de API en Español:**

```bash
# Obtener info de usuario en español
curl -H "Accept-Language: es" \
     -H "Authorization: Bearer token" \
     https://api-url/api/users/me

# Crear usuario con respuestas en español
curl -X POST \
     -H "Accept-Language: es" \
     -H "Content-Type: application/json" \
     -d '{"name":"Juan","email":"juan@example.com","language":"es"}' \
     https://api-url/api/users

# Obtener datos formateados en locale español
curl -H "Accept-Language: es" \
     https://api-url/api/reports/financial
```

### **Formato de Respuesta:**

```json
{
  "success": true,
  "message": "Operación completada con éxito",
  "data": {
    "user": {
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "createdAt": "25/10/2025 15:30:00",
      "balance": "€1.000,00"
    }
  },
  "meta": {
    "timestamp": "2025-10-25T18:30:00.000Z",
    "language": "es"
  }
}
```

## 🌍 **Soporte de Idiomas**

### **Idiomas Soportados:**

- 🇧🇷 **Portugués (pt)** - Predeterminado
- 🇺🇸 **Inglés (en)**
- 🇪🇸 **Español (es)**

### **Orden de Detección de Idioma:**

1. HTTP Header: `Accept-Language`
2. Query Parameter: `?lang=es`
3. Cookie: `language=es`
4. Request Body: `{"language": "es"}`
5. Predeterminado: Portugués

### **Formatos de Fecha:**

- Portugués: `25/10/2025`
- Inglés: `10/25/2025`
- Español: `25/10/2025`

### **Formatos de Moneda:**

- Portugués: `R$ 1.000,00`
- Inglés: `$1,000.00`
- Español: `€1.000,00`

## 🔗 **Enlaces Útiles**

- [Documentación en Portugués](../pt/README.md)
- [Documentación en Inglés](../en/README.md)
- [Documentación de API](./API.md)
- [Guía de Configuración](./SETUP.md)
- [Documentación AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Serverless Framework](https://www.serverless.com/framework/docs/)

## 🆘 **Soporte**

Para preguntas o problemas:

1. Revisar la documentación en tu idioma
2. Revisar los ejemplos de API
3. Probar con diferentes headers de idioma
4. Revisar logs de CloudWatch para debugging
