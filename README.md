# Node.js Serverless API - Estrutura Simples e Escalável para AWS Lambda

Este projeto é uma **estrutura inicial para uma API Node.js rodando em Lambda**, integrando RDS, autenticação JWT e pagamentos. Focado em **simplicidade e escalabilidade**, ideal para aplicações React no front-end.

---

## Estrutura de Pastas

project-root/
│
├─ src/
│ ├─ controllers/ # Funções que lidam com requisições
│ ├─ services/ # Lógica de negócios (pagamentos, usuários, etc)
│ ├─ models/ # Modelos de dados (ORM/Prisma)
│ ├─ utils/ # Funções utilitárias (JWT, hashing)
│ ├─ routes.js # Define as rotas da API
│ └─ handler.js # Entry point do Lambda
│
├─ package.json
├─ serverless.yml # Configuração para deploy com Serverless Framework (opcional)
└─ README.md

markdown
Copy code

---

## Tecnologias e Pacotes

- **Node.js 18+**
- **AWS Lambda**
- **AWS RDS (Postgres/MySQL)**
- **JWT** para autenticação
- **bcrypt** para hashing de senhas
- **Stripe** (ou outro) para pagamentos
- **Serverless Framework** ou **SAM** para deploy

Pacotes sugeridos:

```bash
npm install express serverless-http jsonwebtoken bcrypt prisma stripe
Estrutura Básica de Código
handler.js
javascript
Copy code
const serverless = require('serverless-http');
const app = require('./routes');

module.exports.handler = serverless(app);
routes.js
javascript
Copy code
const express = require('express');
const authController = require('./controllers/authController');
const paymentController = require('./controllers/paymentController');

const router = express();

router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/payment', paymentController.processPayment);

module.exports = router;
utils/jwt.js
javascript
Copy code
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: '1h' });
const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
Boas Práticas para Lambda
Stateless: não armazene sessões na memória, use JWT ou banco.

Timeouts curtos: configure o Lambda para 10-15s máximo.

Variáveis de ambiente: coloque secrets e tokens no AWS Secrets Manager ou Parameter Store.

Conexão com RDS: use pooling inteligente ou RDS Proxy para Lambda.

Logs: use console.log para CloudWatch, mas evite imprimir secrets.

Deploy: usar GitHub Actions + Serverless ou SAM para CI/CD.

