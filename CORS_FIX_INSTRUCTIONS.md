# Correção do Erro de CORS - Instruções Passo a Passo

## Problema Identificado

O frontend em produção (https://agridom-dashboard.vercel.app) está tentando acessar o backend local (localhost:3001), mas está sendo bloqueado por CORS. Isso acontece porque:

1. O backend não está configurado no Vercel com as variáveis de ambiente corretas
2. O script SQL do Supabase pode não ter sido executado
3. As configurações de CORS não incluem o domínio de produção

## Solução - Passos para Corrigir

### 1. Executar o Script SQL no Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto: `vzenddhcscnywdrebdsg`
3. Vá em **SQL Editor**
4. Copie todo o conteúdo do arquivo `database/setup-supabase.sql`
5. Cole no editor SQL e execute
6. Verifique se todas as tabelas foram criadas com sucesso

### 2. Configurar Variáveis de Ambiente no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Vá para o projeto `agridom-dashboard`
3. Acesse **Settings** > **Environment Variables**
4. Adicione as seguintes variáveis:

```
NODE_ENV=production
FRONTEND_URL=https://agridom-dashboard.vercel.app
BACKEND_URL=https://agridom-dashboard.vercel.app/api
CORS_ORIGIN=https://agridom-dashboard.vercel.app
SUPABASE_DB_HOST=db.vzenddhcscnywdrebdsg.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=Beatriz@2908200
SUPABASE_URL=https://vzenddhcscnywdrebdsg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTIwMTMsImV4cCI6MjA3MjQ4ODAxM30.AS-D4tkTHVInT7vDaJxbU58MLU0BejY0aHqzP1fnlaw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMjAxMywiZXhwIjoyMDcyNDg4MDEzfQ.P1ehn1vZvVqH0T9ft6q10sxNpGxeSxGBsZKNZPJRDlU
JWT_SECRET=sua_chave_jwt_super_secreta_e_longa_aqui_com_pelo_menos_32_caracteres
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
```

### 3. Fazer Redeploy no Vercel

1. Após configurar todas as variáveis
2. Vá para **Deployments**
3. Clique nos três pontos (...) no deployment mais recente
4. Selecione **Redeploy**
5. Aguarde o deploy ser concluído

### 4. Testar a Aplicação

1. Acesse https://agridom-dashboard.vercel.app
2. Tente fazer login com:
   - **Email:** admin@webdesign.com
   - **Senha:** admin123
3. Verifique se não há erros de CORS no console

## Verificações Importantes

### No Console do Navegador
- Não deve aparecer erros de CORS
- Não deve aparecer "Failed to fetch"
- As requisições devem ir para `/api/auth/login` (mesma origem)

### No Vercel Functions Log
- Acesse **Functions** no painel do Vercel
- Verifique se há logs de erro do backend
- Confirme se a conexão com Supabase está funcionando

### No Supabase
- Verifique se as tabelas foram criadas
- Confirme se o usuário admin foi inserido
- Teste a conectividade do banco

## Problemas Comuns e Soluções

### 1. Erro "ENOTFOUND" ou "Connection timeout"
**Causa:** Problema de conectividade com Supabase
**Solução:** 
- Verifique se o hostname está correto: `db.vzenddhcscnywdrebdsg.supabase.co`
- Confirme se a senha está correta
- Teste a conexão diretamente no Supabase

### 2. Erro 404 nas rotas da API
**Causa:** Configuração incorreta do vercel.json
**Solução:**
- Verifique se o `vercel.json` está redirecionando `/api/*` para `/server/server.js`
- Confirme se o arquivo `server/server.js` existe

### 3. Erro "Cannot read property of undefined"
**Causa:** Variáveis de ambiente não carregadas
**Solução:**
- Verifique se todas as variáveis estão configuradas no Vercel
- Confirme se `NODE_ENV=production` está definido
- Faça um novo deploy após configurar as variáveis

### 4. Login não funciona mesmo sem erros de CORS
**Causa:** Tabelas não criadas ou usuário admin não existe
**Solução:**
- Execute o script `setup-supabase.sql` no Supabase
- Verifique se o usuário admin foi criado
- Teste a conexão com o banco

## Status Atual

✅ Frontend configurado corretamente para produção  
✅ Backend configurado para usar Supabase  
✅ Arquivo .env.production atualizado  
✅ CORS configurado para aceitar o domínio de produção  
⏳ **Pendente:** Configurar variáveis no Vercel  
⏳ **Pendente:** Executar script SQL no Supabase  
⏳ **Pendente:** Fazer redeploy no Vercel  

## Próximos Passos

1. **URGENTE:** Configure as variáveis de ambiente no Vercel
2. **URGENTE:** Execute o script SQL no Supabase
3. **URGENTE:** Faça o redeploy no Vercel
4. Teste o login na aplicação
5. Monitore os logs para garantir que tudo está funcionando

Após seguir esses passos, o erro de CORS deve ser resolvido e a aplicação deve funcionar corretamente em produção.