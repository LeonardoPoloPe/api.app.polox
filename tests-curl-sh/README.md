# 🧪 Suite de Testes Automatizados - Polox API

Este diretório contém scripts de teste bash/curl para validar todos os endpoints da API Polox.

## 📋 Estrutura

```
tests-curl-sh/
├── run-all-tests.sh                  # Script master (roda todos os testes)
├── test-contact-controller.sh        # Testes de Contatos (Identidade Unificada)
├── test-deal-controller.sh           # Testes de Negociações (Pipeline)
├── test-contact-note-controller.sh   # Testes de Histórico de Interações
└── resultado/                        # Logs gerados automaticamente
    ├── test-contact-controller_*.log
    ├── test-deal-controller_*.log
    ├── test-contact-note_*.log
    ├── summary-*.txt
    └── master-test_*.log
```

## 🚀 Como Usar

### Rodar TODOS os testes

```bash
./tests-curl-sh/run-all-tests.sh
```

### Rodar um controller específico

```bash
# ContactController
./tests-curl-sh/run-all-tests.sh contact

# DealController
./tests-curl-sh/run-all-tests.sh deal

# ContactNoteController
./tests-curl-sh/run-all-tests.sh note
```

### Rodar teste individual

```bash
./tests-curl-sh/test-contact-controller.sh
./tests-curl-sh/test-deal-controller.sh
./tests-curl-sh/test-contact-note-controller.sh
```

## 📊 O que é testado

### ✅ ContactController (23 testes)
- ✓ Login e autenticação
- ✓ CRUD completo (Create, Read, Update, Delete)
- ✓ Busca por phone, email, document
- ✓ Filtros (tipo, origem, temperatura)
- ✓ Get-or-Create (upsert inteligente)
- ✓ Get-or-Create-with-Negotiation (cria contato + deal)
- ✓ Conversão Lead → Cliente
- ✓ Estatísticas
- ✓ Validações de campos obrigatórios
- ✓ Soft delete

### 💼 DealController (22 testes)
- ✓ CRUD de negociações
- ✓ Listagem por contato
- ✓ Movimentação entre etapas do funil
- ✓ Marcar como Ganha (Win) - converte lead em cliente
- ✓ Marcar como Perdida (Lost) com motivo
- ✓ Reabrir negociação fechada
- ✓ Filtros (etapa, origem, status)
- ✓ Estatísticas do pipeline
- ✓ Validações (contato obrigatório, título, etc)
- ✓ Soft delete

### 📝 ContactNoteController (21 testes)
- ✓ CRUD de notas/histórico
- ✓ Tipos: nota, ligacao, email, reuniao, whatsapp
- ✓ Listagem geral e por contato
- ✓ Notas recentes (timeline)
- ✓ Estatísticas por contato
- ✓ Estatísticas gerais da empresa
- ✓ Filtros por tipo
- ✓ Busca por texto no conteúdo
- ✓ Validações (conteúdo mínimo, tipo válido)
- ✓ Soft delete

## 🔧 Configuração

### Credenciais de Teste

Os scripts usam as seguintes credenciais (definidas em cada arquivo):

```bash
BASE_URL="http://localhost:3000/api/v1"
EMAIL="polo@polox.com.br"
PASSWORD="M@eamor1122"
CONTACT_ID="41"      # Para testes de Deal e Notes
COMPANY_ID="1"       # Para testes de Company
```

### Pré-requisitos

- **Servidor rodando**: `npm run dev` ou `sls offline`
- **Banco de dados**: PostgreSQL com dados de teste
- **jq**: Parser JSON para bash
  ```bash
  # macOS
  brew install jq
  
  # Linux
  sudo apt-get install jq
  ```

## 📄 Logs

Cada execução gera:

1. **Log detalhado**: `test-{controller}_{timestamp}.log`
   - Todas as requisições e respostas
   - Status codes
   - Responses completos em JSON

2. **Resumo**: `summary-{controller}_{timestamp}.txt`
   - Estatísticas consolidadas
   - Taxa de sucesso
   - Status final

3. **Master log**: `master-test_{timestamp}.log` (quando usando run-all-tests.sh)
   - Overview de todas as suites executadas

## 🎯 Padrões de Teste

### Estrutura de cada teste

```bash
make_request "METHOD" "/endpoint" \
'{
    "campo": "valor"
}' \
"Descrição do teste" [status_esperado]
```

### Status codes esperados

- **2xx**: Sucesso ✅
- **400**: Validação (esperado em testes de validação) ✅
- **404**: Not found (esperado ao buscar recursos deletados) ✅
- **Outros**: Erro ❌

### Exemplo de validação

```bash
# Este teste DEVE retornar 400
make_request "POST" "/contacts" \
'{
    "phone": "5511888888888"
}' \
"Tentar criar contato sem nome (deve falhar)" "400"  # ← Status esperado
```

## 📈 Interpretando Resultados

### Sucesso Total
```
✅ Testes concluídos!

📊 Estatísticas:
   Total de testes: 23
   ✅ Passaram: 23
   ❌ Falharam: 0
   📈 Taxa de sucesso: 100.00%

🎉 TODOS OS TESTES PASSARAM!
✅ Sistema pronto para produção
```

### Com Falhas
```
📊 Estatísticas:
   Total de testes: 23
   ✅ Passaram: 20
   ❌ Falharam: 3
   📈 Taxa de sucesso: 86.96%

⚠️  ALGUNS TESTES FALHARAM
❌ Verifique o log detalhado
```

## 🐛 Troubleshooting

### Erro: "TOKEN is null"
- Verifique se o servidor está rodando
- Confirme as credenciais em cada script
- Verifique o endpoint de login

### Erro: "CONTACT_ID not found"
- Execute o script de ContactController primeiro
- Ou ajuste o CONTACT_ID para um contato existente no banco

### Erro: "command not found: jq"
- Instale o jq: `brew install jq` (macOS) ou `apt-get install jq` (Linux)

### Erro: "Permission denied"
- Torne os scripts executáveis:
  ```bash
  chmod +x tests-curl-sh/*.sh
  ```

## 🔄 Integração Contínua

Para usar em CI/CD:

```yaml
# .github/workflows/api-tests.yml
- name: Run API Tests
  run: |
    npm run dev &
    sleep 10
    ./tests-curl-sh/run-all-tests.sh
```

## 📝 Convenções

- **Login**: Sempre o primeiro passo de cada script
- **IDs**: Capturados dinamicamente das respostas
- **Cleanup**: Soft delete ao final (não afeta banco permanentemente)
- **Sleep**: 1 segundo entre testes para logs legíveis
- **Cores**: Verde=sucesso, Vermelho=erro, Amarelo=info, Azul=header

## 🎨 Output Colorido

Os scripts usam cores ANSI para melhor legibilidade:

- 🟢 Verde: Sucesso
- 🔴 Vermelho: Erro
- 🟡 Amarelo: Informação/Teste em execução
- 🔵 Azul: Headers/Separadores

## 📚 Documentação Adicional

- **Swagger/OpenAPI**: http://localhost:3000/docs
- **Arquitetura**: `/docs/ESTRUTURA_PROJETO.md`
- **Guia de Testes**: `/docs/GUIA_BATERIA_TESTES.md`

## 🤝 Contribuindo

Ao adicionar novos controllers:

1. Crie `test-{controller}-controller.sh` seguindo o padrão
2. Adicione ao `run-all-tests.sh` na lista de testes
3. Documente neste README
4. Garanta cobertura de:
   - CRUD completo
   - Filtros e buscas
   - Validações
   - Casos de erro esperados

## ✅ Checklist de Qualidade

Cada script deve ter:

- [ ] Login no início
- [ ] Captura dinâmica de IDs
- [ ] Testes de sucesso (2xx)
- [ ] Testes de validação (400)
- [ ] Testes de not found (404)
- [ ] Soft delete ao final
- [ ] Logs detalhados
- [ ] Resumo com estatísticas
- [ ] Cores no output
- [ ] Sleep entre requests

---

**Última atualização**: 05/11/2025  
**Autor**: Leonardo Polo  
**Versão**: 1.0.0
