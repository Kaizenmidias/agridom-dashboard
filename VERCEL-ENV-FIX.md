# 🚨 CORREÇÃO URGENTE: Variáveis de Ambiente na Vercel

## Problema Identificado
O erro `Invalid API key` indica que as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` não estão sendo carregadas em produção.

## ✅ Solução Passo a Passo

### 1. Configurar Variáveis na Vercel Dashboard

1. **Acesse:** https://vercel.com/dashboard
2. **Selecione o projeto:** `agridom-dashboard`
3. **Vá para:** Settings → Environment Variables
4. **Adicione as seguintes variáveis:**

```
VITE_SUPABASE_URL = https://qwbpruywwfjadkudegcj.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjMyNTAsImV4cCI6MjA3MjUzOTI1MH0.dyXrYaREdizc-UZM6NJP1Dp7RpDlzbU4pxHutJhGoy8
VITE_API_URL = https://agridom-dashboard.vercel.app
```

**IMPORTANTE:** Marque todas as variáveis para os ambientes:
- ✅ Production
- ✅ Preview 
- ✅ Development

### 2. Verificar vercel.json

O arquivo `vercel.json` já está configurado corretamente com as variáveis.

### 3. Fazer Redeploy

**Opção A - Via Dashboard:**
1. Vá para a aba "Deployments"
2. Clique nos 3 pontos do último deploy
3. Selecione "Redeploy"

**Opção B - Via Git:**
```bash
git commit --allow-empty -m "trigger redeploy with env vars"
git push origin main
```

### 4. Verificar se Funcionou

1. **Aguarde o deploy** (2-3 minutos)
2. **Abra a aplicação:** https://agridom-dashboard.vercel.app
3. **Abra DevTools** (F12) → Console
4. **Procure pelos logs:**
   - `🚀 MAIN.TSX` - deve mostrar as variáveis
   - `🔍 SUPABASE.TS` - deve mostrar inicialização
   - `🔍 CRUD.TS` - deve mostrar chamadas

5. **Teste uma página:**
   - Vá para `/projects` ou `/codes`
   - Verifique se os dados carregam
   - Não deve aparecer "Invalid API key"

## 🔍 Debug Adicional

Se ainda não funcionar, execute no console do navegador:

```javascript
// Cole este código no console da aplicação em produção
console.log('🔍 DEBUG PRODUÇÃO:');
console.log('URL:', window.location.href);
console.log('Procure por logs que começam com 🚀 ou 🔍');

// Monitorar chamadas
window.monitorSupabase = function() {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('supabase')) {
      console.log('📡 CHAMADA SUPABASE:', url);
    }
    return originalFetch.apply(this, args);
  };
  console.log('✅ Monitoramento ativo');
};
window.monitorSupabase();
```

## 📋 Checklist de Verificação

- [ ] Variáveis configuradas na Vercel Dashboard
- [ ] Variáveis marcadas para Production
- [ ] Redeploy realizado
- [ ] Aguardou 2-3 minutos para deploy
- [ ] Testou a aplicação
- [ ] Verificou logs no console
- [ ] Não aparece mais "Invalid API key"

## 🆘 Se Ainda Não Funcionar

1. **Verifique se as variáveis estão visíveis** na Vercel Dashboard
2. **Tente fazer um novo deploy** do zero
3. **Verifique se não há cache** (Ctrl+Shift+R)
4. **Contate o suporte** se necessário

---

**Status:** 🔴 CRÍTICO - Aplicação não funciona em produção
**Prioridade:** MÁXIMA
**Tempo estimado:** 5-10 minutos