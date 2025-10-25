# 🧪 TESTES MULTI-IDIOMAS - WINDOWS POWERSHELL

**Data:** 25 de outubro de 2025  
**Sistema:** Windows PowerShell  
**Servidor:** Local (http://localhost:3000)

## 🚀 **COMANDOS DE TESTE - WINDOWS**

### **1. Testar Health Check - Português (Padrão)**

```powershell
# Teste básico
Invoke-WebRequest -Uri "http://localhost:3000/health" | Select-Object -ExpandProperty Content

# Teste formatado
Invoke-WebRequest -Uri "http://localhost:3000/health" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **2. Testar Health Check - Inglês**

```powershell
# Criar headers para inglês
$headers = @{
    'Accept-Language' = 'en'
}

# Fazer requisição
Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **3. Testar Health Check - Espanhol**

```powershell
# Criar headers para espanhol
$headers = @{
    'Accept-Language' = 'es'
}

# Fazer requisição
Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **4. Testar Endpoint de Idiomas**

```powershell
# Obter informações de idiomas suportados
Invoke-WebRequest -Uri "http://localhost:3000/languages" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **5. Testar API Root - Multi-idioma**

```powershell
# Português (padrão)
Invoke-WebRequest -Uri "http://localhost:3000/" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Inglês
$headers = @{ 'Accept-Language' = 'en' }
Invoke-WebRequest -Uri "http://localhost:3000/" -Headers $headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Espanhol
$headers = @{ 'Accept-Language' = 'es' }
Invoke-WebRequest -Uri "http://localhost:3000/" -Headers $headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **6. Testar com Query Parameter**

```powershell
# Inglês via query parameter
Invoke-WebRequest -Uri "http://localhost:3000/health?lang=en" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Espanhol via query parameter
Invoke-WebRequest -Uri "http://localhost:3000/health?lang=es" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## 🔄 **REINICIAR SERVIDOR**

Para aplicar as mudanças do sistema i18n, reinicie o servidor:

```powershell
# 1. Parar o servidor atual (Ctrl+C no terminal do servidor)
# 2. Reiniciar
npm run dev:local
```

## ✅ **RESPOSTAS ESPERADAS**

### **Português (pt):**

```json
{
  "success": true,
  "message": "Status da API",
  "data": {
    "status": "Saudável",
    "database": "Banco de dados conectado",
    "environment": "Ambiente: development",
    "language": {
      "current": "pt",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

### **Inglês (en):**

```json
{
  "success": true,
  "message": "API Status",
  "data": {
    "status": "Healthy",
    "database": "Database connected",
    "environment": "Environment: development",
    "language": {
      "current": "en",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

### **Espanhol (es):**

```json
{
  "success": true,
  "message": "Estado de la API",
  "data": {
    "status": "Saludable",
    "database": "Base de datos conectada",
    "environment": "Ambiente: development",
    "language": {
      "current": "es",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

## 🛠️ **SCRIPT DE TESTE COMPLETO**

Crie um arquivo `test-i18n.ps1`:

```powershell
# Test Multi-language API
Write-Host "🧪 Testando API Multi-idiomas..." -ForegroundColor Green

# Português
Write-Host "`n🇧🇷 Testando Português:" -ForegroundColor Yellow
Invoke-WebRequest -Uri "http://localhost:3000/health" | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object message, data

# Inglês
Write-Host "`n🇺🇸 Testando Inglês:" -ForegroundColor Yellow
$headers_en = @{ 'Accept-Language' = 'en' }
Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers_en | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object message, data

# Espanhol
Write-Host "`n🇪🇸 Testando Espanhol:" -ForegroundColor Yellow
$headers_es = @{ 'Accept-Language' = 'es' }
Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers_es | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object message, data

# Idiomas suportados
Write-Host "`n🌍 Idiomas suportados:" -ForegroundColor Yellow
Invoke-WebRequest -Uri "http://localhost:3000/languages" | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object data

Write-Host "`n✅ Testes concluídos!" -ForegroundColor Green
```

Execute com:

```powershell
.\test-i18n.ps1
```

## 🔍 **DEBUGGING**

Se as traduções não aparecerem:

1. **Verificar se o servidor foi reiniciado**
2. **Verificar logs do servidor** para erros i18n
3. **Testar arquivos de tradução**:
   ```powershell
   Get-Content src\locales\pt\common.json | ConvertFrom-Json
   Get-Content src\locales\en\common.json | ConvertFrom-Json
   Get-Content src\locales\es\common.json | ConvertFrom-Json
   ```

## 🚀 **PRÓXIMO PASSO**

Após reiniciar o servidor, execute os testes para validar que o sistema multi-idioma está funcionando corretamente!
