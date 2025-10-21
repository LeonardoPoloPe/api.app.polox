# Instruções para Configuração do AWS CLI e Parâmetros

## 1. Configurar Credenciais AWS

Execute os comandos abaixo no PowerShell, substituindo pelos seus valores:

```powershell
# Configure suas credenciais AWS
aws configure set aws_access_key_id SEU_ACCESS_KEY_AQUI
aws configure set aws_secret_access_key SUA_SECRET_KEY_AQUI
aws configure set default.region sa-east-1
aws configure set default.output json
```

## 2. Verificar Configuração

```powershell
# Verificar se as credenciais estão funcionando
aws sts get-caller-identity
```

## 3. Configurar Parâmetros no AWS Systems Manager

Após configurar as credenciais, execute estes comandos para criar os parâmetros:

### Senhas do Banco de Dados

```powershell
# Desenvolvimento
aws ssm put-parameter --name "/polox/dev/db/password" --value "SUA_SENHA_DEV_SEGURA_AQUI" --type "SecureString" --region sa-east-1

# Sandbox
aws ssm put-parameter --name "/polox/sandbox/db/password" --value "SUA_SENHA_SANDBOX_SEGURA_AQUI" --type "SecureString" --region sa-east-1

# Produção
aws ssm put-parameter --name "/polox/prod/db/password" --value "SUA_SENHA_PROD_SEGURA_AQUI" --type "SecureString" --region sa-east-1
```

### JWT Secrets

```powershell
# Desenvolvimento
aws ssm put-parameter --name "/polox/dev/jwt/secret" --value "SEU_JWT_SECRET_DEV_MUITO_LONGO_E_ALEATORIO" --type "SecureString" --region sa-east-1

# Sandbox
aws ssm put-parameter --name "/polox/sandbox/jwt/secret" --value "SEU_JWT_SECRET_SANDBOX_MUITO_LONGO_E_ALEATORIO" --type "SecureString" --region sa-east-1

# Produção
aws ssm put-parameter --name "/polox/prod/jwt/secret" --value "SEU_JWT_SECRET_PROD_MUITO_LONGO_E_ALEATORIO" --type "SecureString" --region sa-east-1
```

> **🔒 IMPORTANTE**: Substitua os valores de exemplo por senhas realmente seguras.
> Consulte o arquivo `docs/.naocompartilhar` para as credenciais corretas (apenas desenvolvedores autorizados).

## 4. Verificar Parâmetros Criados

```powershell
# Listar todos os parâmetros do Polox
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1

# Verificar um parâmetro específico (retorna o valor criptografado)
aws ssm get-parameter --name "/polox/dev/db/password" --with-decryption --region sa-east-1
```

## 5. Comandos para Deletar Parâmetros (se necessário)

```powershell
# Se precisar deletar algum parâmetro para recriar
aws ssm delete-parameter --name "/polox/dev/db/password" --region sa-east-1
aws ssm delete-parameter --name "/polox/sandbox/db/password" --region sa-east-1
aws ssm delete-parameter --name "/polox/prod/db/password" --region sa-east-1
aws ssm delete-parameter --name "/polox/dev/jwt/secret" --region sa-east-1
aws ssm delete-parameter --name "/polox/sandbox/jwt/secret" --region sa-east-1
aws ssm delete-parameter --name "/polox/prod/jwt/secret" --region sa-east-1
```

## 📝 Próximos Passos

1. Configure suas credenciais AWS usando os comandos da seção 1
2. Verifique se estão funcionando com o comando da seção 2
3. Execute os comandos da seção 3 para criar todos os parâmetros
4. Verifique se os parâmetros foram criados com os comandos da seção 4
5. Continue com o setup do banco de dados PostgreSQL

## ⚠️ Importante

- **Substitua as senhas de exemplo** por senhas realmente seguras
- **Mantenha suas credenciais AWS seguras** e nunca as compartilhe
- **Os parâmetros ficam criptografados** no AWS Systems Manager
- **Use senhas diferentes** para cada ambiente (dev, sandbox, prod)
