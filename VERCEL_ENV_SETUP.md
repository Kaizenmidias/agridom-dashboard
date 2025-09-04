# Configuração de Variáveis de Ambiente na Vercel

## ⚠️ IMPORTANTE
As variáveis de ambiente foram removidas do `vercel.json` por questões de segurança. Elas devem ser configuradas diretamente no painel da Vercel.

## 📋 Variáveis Necessárias

Configure as seguintes variáveis de ambiente no painel da Vercel:

### 🔗 Supabase Database
```
SUPABASE_URL=https://rxvcvlegxljinevhmbyk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmN2bGVneGxqaW5ldmhtYnlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjYyNjEsImV4cCI6MjA3MjUwMjI2MX0.E2uZRZjJjxQqBnxd1A_LP690BxYDWrBe-N4dXD3gZFA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmN2bGVneGxqaW5ldmhtYnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkyNjI2MSwiZXhwIjoyMDcyNTAyMjYxfQ.Q9u5aVKEpE3wZpnBpZIU4XjXk-tIazKkhzUK5F2bNfw
SUPABASE_DB_HOST=db.rxvcvlegxljinevhmbyk.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=KJ4E7xKy0SCEVIX7
SUPABASE_DATABASE_URL=postgresql://postgres:KJ4E7xKy0SCEVIX7@db.rxvcvlegxljinevhmbyk.supabase.co:5432/postgres
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