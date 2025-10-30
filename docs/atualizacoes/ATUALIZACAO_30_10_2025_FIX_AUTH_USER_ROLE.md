# 30/10/2025 — Correção login: coluna user_role não encontrada

Contexto: Ao tentar fazer login em http://localhost:3000/api/v1/auth/login era retornado erro 500 com a mensagem:

- code 42703 — column "user_role" does not exist

Diagnóstico:

- O banco possuía duas tabelas `users`: `polox.users` (com a coluna `user_role`) e `public.users` (sem essa coluna).
- Em alguns contextos, a query `FROM users` estava resolvendo para `public.users`, gerando o erro.
- As migrations estavam OK (029 executada) e `polox.users` continha `user_role`.

Correção aplicada:

- Atualizado `src/controllers/authController.js` para qualificar explicitamente o schema nas consultas de login e registro:
  - `FROM polox.users` em vez de `FROM users`.
  - `UPDATE polox.users ...` para `last_login_at`.
  - `INSERT INTO polox.users ...` no registro.

Resultado esperado:

- Login passa a selecionar da tabela correta (`polox.users`), onde `user_role` existe, eliminando o erro 42703.

Ações recomendadas:

- Preferir sempre qualificar com `polox.` nas consultas às tabelas principais para evitar dependência do `search_path`.
- Reiniciar o servidor local após a alteração de código.
- Caso o problema persista, verificar `search_path` da sessão e permissões do usuário do banco.
