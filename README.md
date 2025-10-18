# Estrutura do Projeto - Node.js Serverless API

Esta é a **estrutura base para a API Node.js rodando em AWS Lambda**, com foco em simplicidade, escalabilidade e boas práticas.

---

## Estrutura de Pastas

project-root/
│
├─ src/
│ ├─ controllers/ # Lidam com requisições HTTP, validam dados e chamam services
│ ├─ services/ # Lógica de negócios, pagamentos, autenticação, regras específicas
│ ├─ models/ # Modelos de dados, integração com banco (ORM ou Prisma)
│ ├─ utils/ # Funções utilitárias, helpers, JWT, hashing de senha, formatação
│ ├─ routes.js # Define todas as rotas da API e seus métodos HTTP
│ └─ handler.js # Entry point do Lambda, integra Express com serverless-http
│
├─ package.json
├─ serverless.yml # Configuração para deploy Serverless Framework ou SAM
└─ README.md

markdown
Copy code

---

## Detalhes de cada pasta/arquivo

- **controllers/**  
  Recebe requisições, faz validações básicas, chama funções do service correspondente e retorna resposta.  
  Exemplo: `authController.js`, `paymentController.js`.

- **services/**  
  Toda lógica de negócio fica aqui. Ex: autenticação, regras de pagamento, integração com Stripe, etc.  
  Nunca coloque lógica complexa diretamente nos controllers.

- **models/**  
  Representa a estrutura do banco. Pode usar Prisma ou outro ORM.  
  Ex: `User.js`, `Payment.js`.

- **utils/**  
  Funções genéricas ou helpers: JWT, hashing de senha, formatação de data, validação de campos.

- **routes.js**  
  Define rotas e vincula controllers. Exemplo:
  ```js
  router.post('/login', authController.login);
  router.post('/signup', authController.signup);
  router.post('/payment', paymentController.processPayment);
handler.js
Entry point do Lambda, conecta Express ao serverless:

js
Copy code
const serverless = require('serverless-http');
const app = require('./routes');
module.exports.handler = serverless(app);
Tecnologias e Pacotes
Node.js 18+

AWS Lambda

AWS RDS (Postgres ou MySQL)

JWT para autenticação

bcrypt para hashing de senhas

Stripe (ou outro) para pagamentos

Serverless Framework ou SAM para deploy

Boas práticas
Controllers não devem conter lógica de negócio.

Lambdas devem ser stateless (usar JWT, não sessions em memória).

Variáveis de ambiente e secrets no AWS Secrets Manager ou Parameter Store.

Logs via console.log → CloudWatch. Evite imprimir dados sensíveis.

Conexão RDS via pooling ou RDS Proxy para Lambda.

Timeout Lambda: 10-15s máximo.
