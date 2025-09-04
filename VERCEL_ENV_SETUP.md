# Configuração de Variáveis de Ambiente na Vercel

## ⚠️ IMPORTANTE
As variáveis de ambiente foram removidas do `vercel.json` por questões de segurança. Elas devem ser configuradas diretamente no painel da Vercel.

## 🔧 CORREÇÕES DE ERROS COMUNS

### ❌ Erro ENOTFOUND
As configurações abaixo usam o **Transaction Pooler** do Supabase em vez da conexão direta. Isso resolve o erro `getaddrinfo ENOTFOUND db.rxvcvlegxljinevhmbyk.supabase.co` que ocorre na Vercel com funções serverless.

### ❌ Erro "Tenant or user not found"
Este erro indica que o usuário PostgreSQL está incorreto. <mcreference link="https://stackoverflow.com/questions/78422887/error-supabase-hosting-django-db-utils-operationalerror-tenant-or-user-not-fou" index="2">2</mcreference> <mcreference link="https://github.com/orgs/supabase/discussions/30107" index="3">3</mcreference> No Supabase com pooler, o usuário deve ser `postgres.{project_id}` em vez de apenas `postgres`. A string de conexão também deve usar `postgres://` em vez de `postgresql://` para melhor compatibilidade. <mcreference link="https://github.com/orgs/supabase/discussions/20596" index="5">5</mcreference>

## 📋 Variáveis Necessárias

Configure as seguintes variáveis de ambiente no painel da Vercel:

### 🔗 Supabase Database
```
SUPABASE_URL=https://rxvcvlegxljinevhmbyk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmN2bGVneGxqaW5ldmhtYnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjYyNjEsImV4cCI6MjA3MjUwMjI2MX0.E2uZRZjJjxQqBnxd1A_LP690BxYDWrBe-N4dXD3gZFA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmN2bGVneGxqaW5ldmhtYnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkyNjI2MSwiZXhwIjoyMDcyNTAyMjYxfQ.Q9u5aVKEpE3wZpnBpZIU4XjXk-tIazKkhzUK5F2bNfw
SUPABASE_DB_HOST=aws-0-us-east-1.pooler.supabase.com
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.rxvcvlegxljinevhmbyk
SUPABASE_DB_PASSWORD=KJ4E7xKy0SCEVIX7
SUPABASE_DATABASE_URL=postgres://postgres.rxvcvlegxljinevhmbyk:KJ4E7xKy0SCEVIX7@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 🔐 JWT Configuration
```
JWT_SECRET=X0SyOctdJX522yiVbTnywu+ulxOH15GyRjbwr3+5LAQcIYx1i8Vo0qA1OSrzPuWmGFC66Kk6C7luznv+dRQ5Vg==
dashboard_SUPABASE_JWT_SECRET=X0SyOctdJX522yiVbTnywu+ulxOH15GyRjbwr3+5LAQcIYx1i8Vo0qA1OSrzPuWmGFC66Kk6C7luznv+dRQ5Vg==
JWT_EXPIRES_IN=24h
```

### 🌍 Environment

```
NODE_ENV=production
```

## 🔄 Integração Automática do Supabase

Se você conectou o Supabase através da integração automática da Vercel (Storage > Supabase), as seguintes variáveis já foram configuradas automaticamente:

```
dashboard_POSTGRES_URL=postgres://postgres.{project_id}:{password}@aws-0-us-east-1.pooler.supabase.com:6543/{database_name}
dashboard_POSTGRES_PASSWORD={password}
dashboard_POSTGRES_DATABASE={database_name}
dashboard_SUPABASE_SERVICE_ROLE_KEY={service_role_key}
dashboard_POSTGRES_HOST=aws-0-us-east-1.pooler.supabase.com
dashboard_SUPABASE_ANON_KEY={anon_key}
dashboard_POSTGRES_PRISMA_URL={prisma_url}
dashboard_POSTGRES_URL_NON_POOLING={non_pooling_url}
dashboard_SUPABASE_JWT_SECRET={jwt_secret}
dashboard_POSTGRES_USER=postgres.{project_id}
dashboard_NEXT_PUBLIC_SUPABASE_ANON_KEY={anon_key}
```

**✅ Vantagem:** A integração automática já configura o pooler corretamente e resolve os problemas de conexão IPv6.

**⚠️ Importante:** O código foi atualizado para usar prioritariamente as variáveis da integração automática (`dashboard_*`) antes das variáveis manuais.

## 🚀 Como Configurar no Painel da Vercel

1. **Acesse o painel da Vercel:**
   - Vá para [vercel.com](https://vercel.com)
   - Faça login na sua conta

2. **Selecione o projeto:**
   - Clique no projeto "agridom-dashboard"

3. **Acesse as configurações:**
   - Clique na aba "Settings"
   - No menu lateral, clique em "Environment Variables"

4. **Adicione cada variável:**
   - Clique em "Add New"
   - Cole o **nome** da variável (ex: `SUPABASE_URL`)
   - Cole o **valor** da variável
   - Selecione os ambientes: **Production**, **Preview**, **Development**
   - Clique em "Save"

5. **Repita para todas as variáveis** listadas acima

6. **Faça um novo deploy:**
   - Após adicionar todas as variáveis, vá para a aba "Deployments"
   - Clique nos três pontos do último deployment
   - Clique em "Redeploy"

## ✅ Verificação

Após configurar todas as variáveis e fazer o redeploy:

1. Aguarde o deploy terminar (1-2 minutos)
2. Teste o login em: `https://agridom-dashboard.vercel.app`
3. Use as credenciais:
   - **Email:** admin@webdesign.com
   - **Senha:** admin123

## 🔍 Debug

Se ainda houver problemas:

1. Vá para "Functions" > "View Function Logs" no painel da Vercel
2. Mantenha a página aberta
3. Em outra aba, tente fazer login
4. Verifique os logs em tempo real para identificar o erro específico

---

**Nota:** As variáveis foram removidas do código por segurança. Nunca commite credenciais no repositório!