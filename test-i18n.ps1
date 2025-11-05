# 🧪 Teste Multi-idiomas API Polox
# Data: 25 de outubro de 2025
# Sistema: Windows PowerShell

Write-Host "🌐 TESTE SISTEMA MULTI-IDIOMAS - API POLOX" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Verificar se o servidor está rodando
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Servidor está online" -ForegroundColor Green
} catch {
    Write-Host "❌ Servidor não está rodando. Execute: npm run dev:local" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔄 Reinicie o servidor se as mudanças i18n não estiverem aplicadas" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

# Teste 1: Português (padrão)
Write-Host "`n🇧🇷 TESTE 1: PORTUGUÊS (PADRÃO)" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/health" -ForegroundColor Gray
try {
    $response_pt = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction Stop
    $data_pt = $response_pt.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_pt.success)" -ForegroundColor Green
    if ($data_pt.message) {
        Write-Host "Mensagem: $($data_pt.message)" -ForegroundColor Green
    }
    if ($data_pt.data.status) {
        Write-Host "Health Status: $($data_pt.data.status)" -ForegroundColor Green
    }
    if ($data_pt.data.language) {
        Write-Host "Idioma Atual: $($data_pt.data.language.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste português: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 2: Inglês
Write-Host "`n🇺🇸 TESTE 2: INGLÊS" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/health + Accept-Language: en" -ForegroundColor Gray
try {
    $headers_en = @{ 'Accept-Language' = 'en' }
    $response_en = Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers_en -ErrorAction Stop
    $data_en = $response_en.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_en.success)" -ForegroundColor Green
    if ($data_en.message) {
        Write-Host "Message: $($data_en.message)" -ForegroundColor Green
    }
    if ($data_en.data.status) {
        Write-Host "Health Status: $($data_en.data.status)" -ForegroundColor Green
    }
    if ($data_en.data.language) {
        Write-Host "Current Language: $($data_en.data.language.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste inglês: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 3: Espanhol
Write-Host "`n🇪🇸 TESTE 3: ESPANHOL" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/health + Accept-Language: es" -ForegroundColor Gray
try {
    $headers_es = @{ 'Accept-Language' = 'es' }
    $response_es = Invoke-WebRequest -Uri "http://localhost:3000/health" -Headers $headers_es -ErrorAction Stop
    $data_es = $response_es.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_es.success)" -ForegroundColor Green
    if ($data_es.message) {
        Write-Host "Mensaje: $($data_es.message)" -ForegroundColor Green
    }
    if ($data_es.data.status) {
        Write-Host "Estado de Salud: $($data_es.data.status)" -ForegroundColor Green
    }
    if ($data_es.data.language) {
        Write-Host "Idioma Actual: $($data_es.data.language.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste espanhol: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 4: Query Parameter
Write-Host "`n🔗 TESTE 4: QUERY PARAMETER" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/health?lang=en" -ForegroundColor Gray
try {
    $response_query = Invoke-WebRequest -Uri "http://localhost:3000/health?lang=en" -ErrorAction Stop
    $data_query = $response_query.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_query.success)" -ForegroundColor Green
    if ($data_query.message) {
        Write-Host "Message: $($data_query.message)" -ForegroundColor Green
    }
    if ($data_query.data.language) {
        Write-Host "Language via Query: $($data_query.data.language.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste query parameter: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 5: Endpoint de idiomas
Write-Host "`n🌍 TESTE 5: ENDPOINT DE IDIOMAS" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/languages" -ForegroundColor Gray
try {
    $response_langs = Invoke-WebRequest -Uri "http://localhost:3000/languages" -ErrorAction Stop
    $data_langs = $response_langs.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_langs.success)" -ForegroundColor Green
    if ($data_langs.data.supported) {
        Write-Host "Idiomas Suportados: $($data_langs.data.supported -join ', ')" -ForegroundColor Green
    }
    if ($data_langs.data.current) {
        Write-Host "Idioma Atual: $($data_langs.data.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste de idiomas: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 6: API Root
Write-Host "`n🏠 TESTE 6: API ROOT - PORTUGUÊS" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000/" -ForegroundColor Gray
try {
    $response_root = Invoke-WebRequest -Uri "http://localhost:3000/" -ErrorAction Stop
    $data_root = $response_root.Content | ConvertFrom-Json
    
    Write-Host "Status: $($data_root.success)" -ForegroundColor Green
    if ($data_root.message) {
        Write-Host "Mensagem: $($data_root.message)" -ForegroundColor Green
    }
    if ($data_root.data.language) {
        Write-Host "Idioma: $($data_root.data.language.current)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no teste API root: $($_.Exception.Message)" -ForegroundColor Red
}

# Resumo
Write-Host "`n📊 RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if ($data_pt.message -and $data_en.message -and $data_es.message) {
    if ($data_pt.message -ne $data_en.message -and $data_en.message -ne $data_es.message) {
        Write-Host "✅ SUCESSO: Sistema multi-idiomas funcionando!" -ForegroundColor Green
        Write-Host "   - Português: $($data_pt.message)" -ForegroundColor White
        Write-Host "   - Inglês: $($data_en.message)" -ForegroundColor White
        Write-Host "   - Espanhol: $($data_es.message)" -ForegroundColor White
    } else {
        Write-Host "⚠️  ATENÇÃO: Mensagens são iguais - i18n pode não estar funcionando" -ForegroundColor Yellow
        Write-Host "   Reinicie o servidor: npm run dev:local" -ForegroundColor White
    }
} else {
    Write-Host "❌ ERRO: Nem todas as mensagens foram recebidas" -ForegroundColor Red
    Write-Host "   Verifique se o servidor está rodando e reinicie se necessário" -ForegroundColor White
}

Write-Host "`n🎯 Para ver respostas completas, use:" -ForegroundColor Cyan
Write-Host "   `$headers = @{ 'Accept-Language' = 'en' }" -ForegroundColor White
Write-Host "   Invoke-WebRequest -Uri 'http://localhost:3000/health' -Headers `$headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10" -ForegroundColor White

Write-Host "`n🚀 Testes concluídos!" -ForegroundColor Green