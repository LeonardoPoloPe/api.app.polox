# 🌐 Polox API - Multi-Language Documentation

**Last Update:** October 25, 2025

This API now supports **internationalization (i18n)** with **Portuguese**, **English**, and **Spanish**.

## 📋 **Quick Language Access**

| Language          | Documentation     | API Language Header   |
| ----------------- | ----------------- | --------------------- |
| 🇧🇷 **Portuguese** | [docs/pt/](./pt/) | `Accept-Language: pt` |
| 🇺🇸 **English**    | [docs/en/](./en/) | `Accept-Language: en` |
| 🇪🇸 **Spanish**    | [docs/es/](./es/) | `Accept-Language: es` |

## 🚀 **API Endpoints**

### **Health Check (Multi-Language)**

```bash
# Portuguese (default)
curl -H "Accept-Language: pt" https://your-api.com/health

# English
curl -H "Accept-Language: en" https://your-api.com/health

# Spanish
curl -H "Accept-Language: es" https://your-api.com/health
```

### **Language Information**

```bash
# Get supported languages
curl https://your-api.com/languages
```

### **API Root (Welcome)**

```bash
# Multi-language welcome message
curl -H "Accept-Language: en" https://your-api.com/
```

## ⚙️ **Implementation Features**

### ✅ **Completed**

- ✅ **Backend i18n System** - Complete i18next implementation
- ✅ **Multi-language API Responses** - All endpoints respond in user's language
- ✅ **Date/Time Formatting** - Localized formatting (pt-BR, en-US, es-ES)
- ✅ **Currency Formatting** - BRL, USD, EUR support
- ✅ **Error Messages** - Translated validation and error messages
- ✅ **Database Support** - Language fields in users and companies tables

### 🔧 **Language Detection Priority**

1. **HTTP Header**: `Accept-Language: pt|en|es`
2. **Query Parameter**: `?lang=pt|en|es`
3. **Cookie**: `language=pt|en|es`
4. **Request Body**: `{"language": "pt|en|es"}`
5. **Default**: Portuguese (`pt`)

## 📖 **Documentation Structure**

```
docs/
├── README.md                    # This file (multi-language index)
├── pt/                         # Portuguese documentation
│   ├── README.md
│   ├── API.md
│   └── SETUP.md
├── en/                         # English documentation
│   ├── README.md
│   ├── API.md
│   └── SETUP.md
└── es/                         # Spanish documentation
    ├── README.md
    ├── API.md
    └── SETUP.md
```

## 🔧 **For Developers**

### **Translation Files Location**

```
src/locales/
├── pt/common.json              # Portuguese translations
├── en/common.json              # English translations
└── es/common.json              # Spanish translations
```

### **Usage in Code**

```javascript
// In route handlers
app.get("/example", (req, res) => {
  res.sendSuccess({
    message: req.t("messages.success"),
  });
});

// Format currency with user's language
const price = formatCurrencyWithRequest(1000, false, req);
// Returns: R$ 1.000,00 (pt) | $1,000.00 (en) | €1.000,00 (es)

// Format dates with user's language
const date = formatDateWithRequest(new Date(), "dd/MM/yyyy", req);
// Returns: 25/10/2025 (pt/es) | 10/25/2025 (en)
```

---

## 📚 **Documentation by Language**

### 🇧🇷 **Português**

- [📖 README em Português](./pt/README.md)
- [🔧 Configuração e Deploy](./pt/SETUP.md)
- [📋 Documentação da API](./pt/API.md)

### 🇺🇸 **English**

- [📖 README in English](./en/README.md)
- [🔧 Setup and Deploy](./en/SETUP.md)
- [📋 API Documentation](./en/API.md)

### 🇪🇸 **Español**

- [📖 README en Español](./es/README.md)
- [🔧 Configuración y Deploy](./es/SETUP.md)
- [📋 Documentación de la API](./es/API.md)
