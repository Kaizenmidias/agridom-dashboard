# Configuração do Vercel com Supabase

Este guia explica como configurar as variáveis de ambiente no Vercel para o projeto funcionar corretamente com Supabase.

## 1. Acesse o Painel do Vercel

1. Vá para [vercel.com](https://vercel.com)
2. Faça login na sua conta
3. Selecione o projeto `agridom-dashboard`
4. Vá em **Settings** > **Environment Variables**

## 2. Configure as Variáveis de Ambiente

Adicione as seguintes variáveis de ambiente no Vercel:

### Ambiente de Produção
```
NODE_ENV=production
```

### URLs de Produção
```
FRONTEND_URL=https://agridom-dashboard.vercel.app
BACKEND_URL=https://agridom-dashboard.vercel.app/api
CORS_ORIGIN=https://agridom-dashboard.vercel.app
```

### Configurações do Supabase
```
SUPABASE_DB_HOST=db.vzenddhcscnywdrebdsg.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=Beatriz@2908200
SUPABASE_URL=https://vzenddhcscnywdrebdsg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTIwMTMsImV4cCI6MjA3MjQ4ODAxM30.AS-D4tkTHVInT7vDaJxbU58MLU0BejY0aHqzP1fnlaw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMjAxMywiZXhwIjoyMDcyNDg4MDEzfQ.P1ehn1vZvVqH0T9ft6q10sxNpGxeSxGBsZKNZPJRDlU
```

### Configurações JWT
```
JWT_SECRET=sua_chave_jwt_super_secreta_e_longa_aqui_com_pelo_menos_32_caracteres
JWT_EXPIRES_IN=24h
```

### Configurações de Segurança
```
BCRYPT_ROUNDS=12
```

## 3. Configurações de Email (Opcional)

Se você quiser configurar recuperação de senha por email:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
EMAIL_FROM=noreply@seudominio.com
```

## 4. Redeploy do Projeto

Após configurar todas as variáveis:

1. Vá para a aba **Deployments**
2. Clique nos três pontos (...) no deployment mais recente
3. Selecione **Redeploy**
4. Aguarde o deploy ser concluído

## 5. Verificação

Após o redeploy:

1. Acesse https://agridom-dashboard.vercel.app
2. Tente fazer login
3. Verifique se não há mais erros de CORS no console

## Problemas Comuns

### Erro de CORS
- Verifique se `CORS_ORIGIN` está configurado corretamente
- Certifique-se de que a URL não tem barra no final

### Erro de Conexão com Banco
- Verifique se todas as variáveis do Supabase estão corretas
- Confirme se o banco de dados está acessível

### Erro 404 nas APIs
- Verifique se o `vercel.json` está configurado corretamente
- Confirme se as rotas estão sendo redirecionadas para `/server/server.js`

## Suporte

Se você encontrar problemas, verifique:
1. Os logs do Vercel na aba **Functions**
2. O console do navegador para erros de frontend
3. As configurações de rede do Supabase