# Configuração de Variáveis de Ambiente na Vercel

## ⚠️ IMPORTANTE: Configuração Obrigatória para Produção

Para que o dashboard funcione corretamente na Vercel, você **DEVE** configurar as seguintes variáveis de ambiente no painel da Vercel:

### 1. Acesse o Dashboard da Vercel
1. Vá para [vercel.com](https://vercel.com)
2. Acesse seu projeto `agridom-dashboard`
3. Clique em **Settings** > **Environment Variables**

### 2. Adicione as Variáveis Obrigatórias

Adicione **EXATAMENTE** estas variáveis (com prefixo `VITE_`):

```
VITE_SUPABASE_URL=https://qwbpruywwfjadkudegcj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjMyNTAsImV4cCI6MjA3MjUzOTI1MH0.dyXrYaREdizc-UZM6NJP1Dp7RpDlzbU4pxHutJhGoy8
```

### 3. Configuração no Painel da Vercel

Para cada variável:
1. **Name**: `VITE_SUPABASE_URL`
2. **Value**: `https://qwbpruywwfjadkudegcj.supabase.co`
3. **Environment**: Selecione `Production`, `Preview` e `Development`
4. Clique em **Save**

Repita para `VITE_SUPABASE_ANON_KEY`.

### 4. Redeploy

Após adicionar as variáveis:
1. Vá para a aba **Deployments**
2. Clique nos 3 pontos do último deploy
3. Selecione **Redeploy**

### ✅ Verificação

Após o redeploy, o dashboard deve:
- Carregar sem erros
- Permitir login/cadastro
- Exibir e permitir adicionar dados

### 🔍 Debug

Se ainda não funcionar, verifique no console do navegador se as variáveis estão sendo carregadas:
```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
```

### 📝 Notas Importantes

- **SEMPRE** use o prefixo `VITE_` para variáveis do frontend
- As variáveis sem prefixo `VITE_` não são expostas ao cliente
- Certifique-se de que não há espaços extras nos valores
- As chaves são case-sensitive (maiúsculas/minúsculas importam)