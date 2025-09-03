# 🚀 Guia de Deploy: Vercel + MySQL/phpMyAdmin

Este guia explica como fazer o deploy do AgriDom Dashboard na Vercel usando MySQL remoto com phpMyAdmin para gerenciamento do banco de dados.

## 📋 Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Hospedagem compartilhada com MySQL e phpMyAdmin
- Acesso ao cPanel da hospedagem
- Projeto configurado com MySQL (já feito neste repositório)

## 🗄️ Parte 1: Configuração do MySQL Remoto

### 1.1 Criar Banco de Dados

1. **Acesse o cPanel** da sua hospedagem compartilhada
2. **Localize "MySQL Databases"** ou "Bancos de Dados MySQL"
3. **Crie um novo banco de dados:**
   - Nome: `agridom_dashboard` (ou nome de sua preferência)
   - Anote o nome completo (geralmente prefixado com seu usuário)

### 1.2 Criar Usuário MySQL

1. **Na mesma seção "MySQL Databases"**
2. **Crie um novo usuário:**
   - Nome: `agridom_user` (ou nome de sua preferência)
   - Senha: Use uma senha forte e segura
   - Anote usuário e senha

### 1.3 Associar Usuário ao Banco

1. **Na seção "Add User to Database"**
2. **Selecione o usuário criado**
3. **Selecione o banco de dados criado**
4. **Marque "ALL PRIVILEGES"** e confirme

### 1.4 Configurar Acesso Remoto

1. **Localize "Remote MySQL"** no cPanel
2. **Adicione os hosts permitidos:**
   - Para Vercel: `%` (permite qualquer IP)
   - Ou adicione IPs específicos da Vercel se disponíveis
3. **Salve as configurações**

### 1.5 Importar Estrutura do Banco

1. **Acesse phpMyAdmin** via cPanel
2. **Selecione seu banco de dados**
3. **Vá na aba "Importar"**
4. **Selecione o arquivo:** `database/setup-mysql.sql`
5. **Execute a importação**
6. **Verifique se todas as tabelas foram criadas**

## ☁️ Parte 2: Deploy na Vercel

### 2.1 Preparar o Repositório

1. **Certifique-se de que todas as mudanças estão commitadas:**
   ```bash
   git add .
   git commit -m "Configuração para deploy Vercel + MySQL"
   git push origin main
   ```

### 2.2 Conectar à Vercel

1. **Acesse [vercel.com](https://vercel.com)**
2. **Faça login** com sua conta
3. **Clique em "New Project"**
4. **Importe seu repositório** do GitHub/GitLab/Bitbucket
5. **Configure o projeto:**
   - Framework Preset: `Vite`
   - Root Directory: `./` (raiz do projeto)
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 2.3 Configurar Variáveis de Ambiente

1. **Após o deploy inicial, vá em:**
   `Project Settings > Environment Variables`

2. **Adicione as seguintes variáveis:**

   ```env
   NODE_ENV=production
   
   # MySQL Configuration
   DB_HOST=seu-servidor-mysql.com.br
   DB_PORT=3306
   DB_USER=seu_usuario_mysql
   DB_PASSWORD=sua_senha_mysql
   DB_NAME=seu_banco_mysql
   DB_CONNECTION_LIMIT=5
   DB_ACQUIRE_TIMEOUT=30000
   DB_TIMEOUT=30000
   
   # JWT Configuration
   JWT_SECRET=sua_chave_jwt_super_secreta_e_unica
   JWT_EXPIRES_IN=24h
   JWT_REFRESH_EXPIRES_IN=7d
   
   # CORS Configuration
   CORS_ORIGIN=https://seu-projeto.vercel.app
   FRONTEND_URL=https://seu-projeto.vercel.app
   
   # Security
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX=100
   
   # Logging
   LOG_LEVEL=error
   ENABLE_REQUEST_LOGGING=false
   ```

3. **Substitua os valores pelos dados reais:**
   - `seu-servidor-mysql.com.br`: Host do MySQL da sua hospedagem
   - `seu_usuario_mysql`: Usuário criado no passo 1.2
   - `sua_senha_mysql`: Senha do usuário MySQL
   - `seu_banco_mysql`: Nome do banco criado no passo 1.1
   - `sua_chave_jwt_super_secreta`: Chave JWT forte e única
   - `seu-projeto.vercel.app`: URL do seu projeto na Vercel

### 2.4 Redeploy

1. **Após configurar as variáveis de ambiente**
2. **Vá na aba "Deployments"**
3. **Clique nos três pontos** do último deploy
4. **Selecione "Redeploy"**
5. **Aguarde o deploy completar**

## 🧪 Parte 3: Teste e Verificação

### 3.1 Teste de Conectividade

1. **Acesse sua aplicação** na URL da Vercel
2. **Abra o console do navegador** (F12)
3. **Tente fazer login** com credenciais de teste
4. **Verifique se não há erros** de conexão

### 3.2 Verificar Logs

1. **Na Vercel Dashboard:**
   - Vá em `Functions > View Function Logs`
   - Monitore erros de conexão com MySQL

2. **No phpMyAdmin:**
   - Verifique se dados estão sendo inseridos
   - Monitore queries executadas

### 3.3 Criar Usuário Administrador

1. **Via phpMyAdmin:**
   ```sql
   INSERT INTO users (
     email, password, full_name, role, status,
     can_create_users, can_edit_users, can_delete_users, can_view_reports,
     created_at, updated_at
   ) VALUES (
     'admin@agridom.com',
     '$2a$10$exemplo_hash_bcrypt_aqui',
     'Administrador',
     'admin',
     'active',
     1, 1, 1, 1,
     NOW(), NOW()
   );
   ```

2. **Ou use a API de registro** (se disponível)

## 🔧 Parte 4: Configurações Avançadas

### 4.1 Domínio Customizado

1. **Na Vercel Dashboard:**
   - Vá em `Settings > Domains`
   - Adicione seu domínio personalizado
   - Configure DNS conforme instruções

2. **Atualize variáveis de ambiente:**
   - `CORS_ORIGIN`: Seu domínio personalizado
   - `FRONTEND_URL`: Seu domínio personalizado

### 4.2 Monitoramento

1. **Configure alertas** na Vercel para:
   - Falhas de deploy
   - Erros de função
   - Uso de recursos

2. **No MySQL:**
   - Configure logs de slow queries
   - Monitore conexões ativas
   - Configure backups automáticos

### 4.3 Otimizações

1. **Pool de Conexões:**
   - Ajuste `DB_CONNECTION_LIMIT` conforme necessário
   - Monitore uso de conexões

2. **Cache:**
   - Considere implementar Redis para cache
   - Use cache de queries quando apropriado

## 🚨 Solução de Problemas

### Erro de Conexão MySQL

```
Error: connect ETIMEDOUT
```

**Soluções:**
1. Verifique se Remote MySQL está habilitado
2. Confirme host, porta, usuário e senha
3. Teste conexão via phpMyAdmin
4. Verifique firewall da hospedagem

### Erro de Autenticação

```
Error: Access denied for user
```

**Soluções:**
1. Verifique usuário e senha
2. Confirme se usuário tem privilégios no banco
3. Teste login via phpMyAdmin

### Erro de CORS

```
CORS policy: No 'Access-Control-Allow-Origin'
```

**Soluções:**
1. Verifique variável `CORS_ORIGIN`
2. Confirme URL da aplicação
3. Redeploy após mudanças

### Timeout de Função

```
Function execution timed out
```

**Soluções:**
1. Otimize queries SQL
2. Ajuste timeouts de conexão
3. Implemente paginação
4. Use índices no banco

## 📚 Recursos Adicionais

- [Documentação Vercel](https://vercel.com/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [phpMyAdmin Documentation](https://docs.phpmyadmin.net/)

## 🔐 Segurança

### Checklist de Segurança

- [ ] JWT_SECRET é forte e único
- [ ] Senhas MySQL são complexas
- [ ] CORS está configurado corretamente
- [ ] Rate limiting está ativo
- [ ] Logs sensíveis estão desabilitados
- [ ] Backup do banco está configurado
- [ ] SSL/HTTPS está ativo
- [ ] Variáveis de ambiente não estão expostas

---

**✅ Parabéns!** Sua aplicação AgriDom Dashboard está agora rodando na Vercel com MySQL remoto e phpMyAdmin para gerenciamento!

Para suporte adicional, consulte a documentação ou abra uma issue no repositório.