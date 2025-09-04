# Variáveis de Ambiente para Produção - Vercel + Supabase

Configure estas variáveis no painel do Vercel em **Settings** > **Environment Variables**:

## Ambiente
```
NODE_ENV=production
```

## URLs da Aplicação
```
FRONTEND_URL=https://agridom-dashboard.vercel.app
BACKEND_URL=https://agridom-dashboard.vercel.app/api
CORS_ORIGIN=https://agridom-dashboard.vercel.app
```

## Configurações PostgreSQL (Supabase)
```
POSTGRES_HOST=db.vzenddhcscnywdrebdsg.supabase.co
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Beatriz@2908200
POSTGRES_URL=postgresql://postgres:Beatriz@2908200@db.vzenddhcscnywdrebdsg.supabase.co:5432/postgres
```

## Configurações Supabase Adicionais
```
SUPABASE_URL=https://vzenddhcscnywdrebdsg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTIwMTMsImV4cCI6MjA3MjQ4ODAxM30.AS-D4tkTHVInT7vDaJxbU58MLU0BejY0aHqzP1fnlaw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5kZGhjc2NueXdkcmViZHNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMjAxMywiZXhwIjoyMDcyNDg4MDEzfQ.P1ehn1vZvVqH0T9ft6q10sxNpGxeSxGBsZKNZPJRDlU
```

## Configurações JWT
```
JWT_SECRET=agridom_dashboard_jwt_secret_key_2024_production_environment_secure
JWT_EXPIRES_IN=24h
```

## Configurações de Segurança
```
BCRYPT_ROUNDS=12
```

## Instruções de Deploy

1. **Configure todas as variáveis acima no Vercel**
2. **Execute o script SQL no Supabase**: `database/setup-supabase.sql`
3. **Execute o script de usuários**: `database/create_users_supabase.sql`
4. **Faça o redeploy da aplicação**
5. **Teste as funcionalidades em produção**

## Credenciais de Teste

- **Admin**: agenciakaizendesign@gmail.com / Beatriz@2908
- **User**: ricardo@gmail.com / 123456