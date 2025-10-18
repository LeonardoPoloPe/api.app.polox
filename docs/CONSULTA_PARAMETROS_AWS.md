# 🔍 Consulta de Parâmetros AWS SSM

## 📋 Comandos de Consulta

### Listar todos os parâmetros do projeto

```powershell
# Listar todos os parâmetros (sem valores)
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1
```

### Consultar parâmetro específico

```powershell
# Consultar parâmetro específico (COM valor - use com cuidado)
aws ssm get-parameter --name "/polox/dev/db/password" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/sandbox/db/password" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/prod/db/password" --with-decryption --region sa-east-1

# JWT Secrets
aws ssm get-parameter --name "/polox/dev/jwt/secret" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/sandbox/jwt/secret" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/prod/jwt/secret" --with-decryption --region sa-east-1
```

## 🛡️ Segurança

- ✅ Credenciais armazenadas no AWS Systems Manager Parameter Store
- ✅ Valores criptografados
- ✅ Acesso controlado por IAM
- ✅ Auditoria automática de acessos

## ⚠️ Importante

- **Use apenas quando necessário** - os parâmetros contêm informações sensíveis
- **Não compartilhe** os valores obtidos
- **Prefira variáveis de ambiente** para desenvolvimento local
- **Consulte `docs/.naocompartilhar`** para credenciais de desenvolvimento (desenvolvedores autorizados)
