# Sistema de Proteção de Propriedade Intelectual - Polo X

## Sistema em Camadas com Watermarks e Validação Automática

---

## 🛡️ Visão Geral

Este sistema implementa **4 camadas de proteção** para dificultar remoção não autorizada de identificação de propriedade e facilitar rastreamento de violações.

---

## 📦 Componentes do Sistema

### 1. **Headers Visíveis** (Camada Legal)

**Arquivo:** Todos os `.js` do projeto  
**Função:** Identificação legal e declaração de propriedade

```javascript
/**
 * POLO X - Proprietary System / Sistema Proprietário
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * Developer: Leonardo Polo Pereira
 * ...
 */
```

**Como adicionar:**

```bash
node scripts/add-copyright-headers.js
```

---

### 2. **Watermarks Invisíveis** (Camada Técnica)

**Arquivo:** `src/utils/watermark.js`  
**Função:** Identificadores ofuscados espalhados pelo código

**Características:**

- ✅ Strings codificadas em Base64
- ✅ Constantes com identificadores únicos
- ✅ Fingerprint do sistema
- ✅ Metadados ocultos

**Exemplo:**

```javascript
const _0x1a2b3c = Buffer.from("UG9sbyBY", "base64").toString(); // "Polo X"
const SYSTEM_SIGNATURE = {
  fingerprint: "PLXX-2025-LP-554199460001",
  owner: "Polo X",
  developer: "Leonardo Polo Pereira",
};
```

**Vantagens:**

- Difícil de encontrar todas as ocorrências
- Não afeta performance
- Pode ser validado em runtime

---

### 3. **Validador de Copyright** (Camada de Runtime)

**Arquivo:** `src/middleware/copyright-validator.js`  
**Função:** Valida propriedade ao iniciar a aplicação

**O que valida:**

1. ✅ Headers de copyright nos arquivos críticos
2. ✅ Integridade dos watermarks
3. ✅ Metadados do sistema
4. ✅ Fingerprint único

**Modos de operação:**

```bash
# Modo permissivo (só alerta, não bloqueia)
NODE_ENV=production

# Modo estrito (bloqueia inicialização se detectar violação)
NODE_ENV=production COPYRIGHT_STRICT_MODE=true
```

**Logs gerados:**

- Console (desenvolvimento)
- Arquivo `logs/copyright-violations.log` (produção)
- Integração com Sentry/CloudWatch (opcional)

**Features:**

```javascript
// Banner ao iniciar
═══════════════════════════════════════════════════════════════
  Polo X Manutencao de Equipamentos de Informatica LTDA
  CNPJ: 55.419.946/0001-89
  Developer: Leonardo Polo Pereira
  License: Proprietary - All Rights Reserved
  System ID: PLXX-2025-LP-554199460001
═══════════════════════════════════════════════════════════════

// Headers HTTP adicionados automaticamente
X-Copyright: Polo X Manutencao de Equipamentos de Informatica LTDA
X-Developer: Leonardo Polo Pereira
X-License: Proprietary
```

---

### 4. **Git Hook de Validação** (Camada de Controle)

**Arquivo:** `scripts/git-hooks/pre-commit`  
**Função:** Impede commits sem headers de copyright

**Instalação:**

```bash
npm run setup:git-hooks
```

**Como funciona:**

1. Antes de cada commit, valida arquivos `.js` modificados
2. Se faltar header → ❌ **BLOQUEIA commit**
3. Se tudo OK → ✅ **Permite commit**

**Output exemplo:**

```
╔════════════════════════════════════════════════════════════════╗
║          POLO X - Copyright Pre-Commit Validator              ║
╚════════════════════════════════════════════════════════════════╝

📝 Validating 3 JavaScript file(s)...

✓ Valid copyright: src/models/User.js
✗ Missing copyright: src/controllers/NewController.js
✓ Valid copyright: src/routes/index.js

═══════════════════════════════════════════════════════════════
❌ COMMIT BLOCKED - Copyright headers missing
═══════════════════════════════════════════════════════════════

Found 1 file(s) without copyright header:
  • src/controllers/NewController.js

💡 Solution: Run this command to add headers:
   node scripts/add-copyright-headers.js
```

**Bypass (não recomendado):**

```bash
git commit --no-verify
```

---

## 🚀 Guia de Uso

### Setup Inicial

```bash
# 1. Adicionar headers em todos os arquivos
node scripts/add-copyright-headers.js

# 2. Instalar Git hooks
npm run setup:git-hooks

# 3. Fazer commit das mudanças
git add .
git commit -m "feat: Add copyright protection system"
```

### Uso Contínuo

**Ao criar novo arquivo `.js`:**

```bash
# Adicionar header automaticamente
node scripts/add-copyright-headers.js

# Ou criar o arquivo já com o header (copiar de .copyright-header.js)
```

**Ao fazer commit:**

- Git hook valida automaticamente
- Se faltar header, bloqueia e mostra como corrigir

**Deploy em produção:**

```bash
# Validador roda automaticamente ao iniciar
NODE_ENV=production node src/handler.js

# Com modo estrito (recomendado)
NODE_ENV=production COPYRIGHT_STRICT_MODE=true node src/handler.js
```

---

## 🔍 Como Detectar Violações

### 1. **Em Desenvolvimento**

- Git hook impede commit sem headers

### 2. **Em Runtime (Produção)**

- Validador detecta ao iniciar
- Logs em `logs/copyright-violations.log`
- Alertas no console

### 3. **Manualmente**

```bash
# Validar arquivos
node scripts/validate-copyrights.js

# Ver logs de violação
cat logs/copyright-violations.log
```

### 4. **Git History**

```bash
# Ver quando headers foram removidos
git log --all -S "POLO X" --source --pretty=format:'%h %ad %s'

# Ver quem modificou
git blame src/arquivo.js
```

---

## 📊 Relatórios e Auditoria

### Estrutura de Log

```json
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "event": "COPYRIGHT_VIOLATION",
  "type": "MISSING_COPYRIGHT_HEADER",
  "severity": "HIGH",
  "file": "src/controllers/SomeController.js",
  "environment": "production",
  "hostname": "ip-172-31-45-12"
}
```

### Integrações Disponíveis

**Sentry:**

```javascript
// No código do validador (já preparado)
if (!integrity.valid) {
  Sentry.captureMessage("Copyright violation detected", "warning");
}
```

**AWS CloudWatch:**

```javascript
// Enviar para CloudWatch Logs
const AWS = require("aws-sdk");
const logs = new AWS.CloudWatchLogs();
// ... código de envio
```

**Slack/Discord Webhook:**

```javascript
// Alertas em tempo real
fetch("https://hooks.slack.com/...", {
  method: "POST",
  body: JSON.stringify({ text: "Copyright violation!" }),
});
```

---

## 🎯 O Que Cada Camada Protege

| Camada                | Protege Contra              | Facilidade de Remoção | Evidência Legal |
| --------------------- | --------------------------- | --------------------- | --------------- |
| **Headers Visíveis**  | Desenvolvedores honestos    | Fácil                 | ✅ Alta         |
| **Watermarks**        | Remoção completa            | Difícil               | ✅ Média        |
| **Validador Runtime** | Execução de código alterado | Médio                 | ✅ Alta         |
| **Git Hooks**         | Commits não autorizados     | Fácil (bypass)        | ✅ Alta         |

---

## ⚠️ Limitações e Realidade

### O Que Este Sistema NÃO Faz

❌ **NÃO** impede 100% a remoção (nada é inviolável)  
❌ **NÃO** criptografa o código  
❌ **NÃO** substitui NDA e contratos legais  
❌ **NÃO** impede cópia por desenvolvedor determinado

### O Que Este Sistema FAZ

✅ **Dificulta** significativamente a remoção  
✅ **Detecta** rapidamente violações  
✅ **Registra** tentativas de alteração  
✅ **Fornece evidências** para processos legais  
✅ **Desencoraja** desenvolvedores mal-intencionados

---

## 🔐 Melhores Práticas

### Para Desenvolvedores

1. ✅ **Sempre** rodar `add-copyright-headers.js` ao criar novos arquivos
2. ✅ **Não** remover watermarks ou validadores
3. ✅ **Revisar** código antes de commit
4. ✅ **Reportar** qualquer tentativa de violação

### Para Administradores

1. ✅ **NDA assinado** por todos os desenvolvedores
2. ✅ **Revisar logs** de violação regularmente
3. ✅ **Modo estrito** em produção
4. ✅ **Backups** frequentes do código
5. ✅ **Code review** obrigatório
6. ✅ **Revogar acessos** imediatamente ao desligar funcionário

---

## 📝 Scripts Disponíveis

```json
{
  "scripts": {
    "copyright:add": "node scripts/add-copyright-headers.js",
    "copyright:validate": "node src/middleware/copyright-validator.js",
    "git-hooks:setup": "node scripts/setup-git-hooks.js"
  }
}
```

**Uso:**

```bash
npm run copyright:add        # Adiciona headers
npm run copyright:validate   # Valida sistema
npm run git-hooks:setup      # Instala hooks
```

---

## 🆘 Troubleshooting

### "Git hook não funciona"

```bash
# Reinstalar
npm run git-hooks:setup

# Verificar permissões (Linux/Mac)
chmod +x .git/hooks/pre-commit

# No Windows, hooks funcionam automaticamente
```

### "Validador bloqueia em dev"

```bash
# Validador só roda em production/sandbox
NODE_ENV=development  # Desabilitado
NODE_ENV=production   # Habilitado
```

### "Falsos positivos no validador"

```bash
# Adicionar arquivos à whitelist
# Editar: src/middleware/copyright-validator.js
const WHITELIST = ['arquivo-gerado.js'];
```

---

## 📚 Arquivos do Sistema

```
projeto/
├── src/
│   ├── utils/
│   │   └── watermark.js              # Watermarks invisíveis
│   └── middleware/
│       └── copyright-validator.js    # Validador runtime
├── scripts/
│   ├── add-copyright-headers.js      # Adiciona headers
│   ├── setup-git-hooks.js            # Instala hooks
│   └── git-hooks/
│       └── pre-commit                # Hook de validação
├── logs/
│   └── copyright-violations.log      # Logs de violação
└── docs/
    └── PROTECAO_PROPRIEDADE_INTELECTUAL.md  # Este arquivo
```

---

## 🔗 Referências

- **Lei do Software:** Lei 9.609/98
- **Direitos Autorais:** Lei 9.610/98
- **Código Penal:** Art. 184
- **INPI:** https://www.gov.br/inpi/pt-br

---

## 📞 Suporte

**Polo X Manutencao de Equipamentos de Informatica LTDA**  
CNPJ: 55.419.946/0001-89  
Developer: Leonardo Polo Pereira  
Email: contato@polox.com.br

---

**Data:** 07 de Novembro de 2025  
**Versão:** 2.0  
**Status:** Sistema Ativo em Produção
