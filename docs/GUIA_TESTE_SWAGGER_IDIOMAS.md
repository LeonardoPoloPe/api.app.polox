# 🌐 Guia: Teste de Multi-Idiomas no Swagger

## ✅ O Que Foi Feito

Adicionei o parâmetro `Accept-Language` nos endpoints do Swagger para permitir testar a API em diferentes idiomas diretamente pela interface do Swagger UI.

## 📝 Endpoints Atualizados

### Auth
- ✅ POST `/auth/login` - Com seletor de idioma
- ✅ POST `/auth/register` - Com seletor de idioma

### Clients  
- ✅ GET `/clients` - Com seletor de idioma
- ✅ POST `/clients` - Com seletor de idioma

## 🧪 Como Testar no Swagger

### 1. Inicie o servidor local:
```bash
npm run dev:local
```

### 2. Acesse o Swagger UI:
```
http://localhost:3000/api-docs
```

### 3. Selecione um endpoint (ex: POST /auth/login)

### 4. Clique em "Try it out"

### 5. Você verá o parâmetro "Accept-Language" com dropdown:
- **pt** - Português (padrão)
- **en** - English
- **es** - Español

### 6. Selecione o idioma desejado

### 7. Preencha os dados e clique em "Execute"

## 📊 Exemplo de Teste

### Login em Português (pt):
```json
{
  "email": "teste@example.com",
  "password": "senha123"
}
```
**Accept-Language:** `pt`

**Resposta esperada (se credenciais inválidas):**
```json
{
  "error": "Credenciais inválidas"
}
```

### Login em Inglês (en):
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
**Accept-Language:** `en`

**Resposta esperada (se credenciais inválidas):**
```json
{
  "error": "Invalid credentials"
}
```

### Login em Espanhol (es):
```json
{
  "email": "prueba@example.com",
  "password": "contraseña123"
}
```
**Accept-Language:** `es`

**Resposta esperada (se credenciais inválidas):**
```json
{
  "error": "Credenciales inválidas"
}
```

## 🔄 Para Adicionar em Outros Endpoints

Para adicionar o parâmetro de idioma em outros endpoints, adicione esta linha logo após `security:` ou no início de `parameters:`:

```yaml
parameters:
  - $ref: '#/components/parameters/AcceptLanguage'
  - (outros parâmetros...)
```

### Exemplo Completo:

```javascript
/**
 * @swagger
 * /seu-endpoint:
 *   get:
 *     summary: Seu endpoint
 *     tags: [Tag]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sucesso
 */
```

## 📋 Checklist de Endpoints Prioritários

- [x] POST /auth/login
- [x] POST /auth/register
- [x] GET /clients
- [x] POST /clients
- [ ] GET /clients/:id
- [ ] PUT /clients/:id
- [ ] DELETE /clients/:id
- [ ] GET /companies
- [ ] POST /companies
- [ ] GET /leads
- [ ] POST /leads
- [ ] GET /sales
- [ ] POST /sales

## 🎯 Próximos Passos

1. Testar os 4 endpoints já configurados
2. Verificar se as respostas estão no idioma correto
3. Adicionar o parâmetro em endpoints restantes conforme necessário
4. Documentar quaisquer problemas encontrados

## 💡 Dicas

- O idioma padrão é **português (pt)** se nenhum for especificado
- O header HTTP enviado é: `Accept-Language: pt|en|es`
- Todas as respostas da API (sucesso e erro) respeitam o idioma selecionado
- Logs de auditoria também são gravados no idioma selecionado

## 🐛 Solução de Problemas

### Problema: Seletor de idioma não aparece
**Solução:** Certifique-se de que o servidor foi reiniciado após as alterações

### Problema: Resposta sempre em português
**Solução:** Verifique se o parâmetro está sendo enviado corretamente no header da requisição

### Problema: Erro 500 ao testar
**Solução:** Verifique os logs do servidor para identificar o erro específico

---

**Última atualização:** 23/01/2025  
**Status:** ✅ Pronto para Testes
