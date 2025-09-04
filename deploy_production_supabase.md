# Deploy para Produção - Supabase

Este documento contém as instruções para aplicar todas as mudanças no ambiente de produção que utiliza Supabase.

## 📋 Checklist de Deploy

### 1. Preparação do Banco de Dados

#### Executar Script SQL no Supabase
1. Acesse o painel do Supabase (https://supabase.com/dashboard)
2. Navegue para seu projeto
3. Vá para **SQL Editor**
4. Execute o script `create_users_supabase.sql`:

```sql
-- Deletar usuários existentes com os mesmos emails (se existirem)
DELETE FROM users WHERE email IN ('lucas@webdesign.com', 'ricardo@webdesign.com');

-- Inserir usuário Lucas (Administrador)
INSERT INTO users (
  email, 
  password, 
  name, 
  role,
  is_active,
  can_access_dashboard,
  can_access_projects,
  can_access_briefings,
  can_access_codes,
  can_access_expenses,
  can_access_crm,
  can_access_users,
  created_at,
  updated_at
) VALUES (
  'agenciakaizendesign@gmail.com',
  '$2b$10$KIbFWbnCRQCn/UB3T16PtecSeJzWaaxHKIA3Wy1k8Jiw4IgaNPpGS', -- senha: Beatriz@2908
  'Lucas',
  'admin',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
);

-- Inserir usuário Ricardo (Usuário)
INSERT INTO users (
  email, 
  password, 
  name, 
  role,
  is_active,
  can_access_dashboard,
  can_access_projects,
  can_access_briefings,
  can_access_codes,
  can_access_expenses,
  can_access_crm,
  can_access_users,
  created_at,
  updated_at
) VALUES (
  'ricardo@gmail.com',
  '$2b$10$6GeyFTYPOvc/4KAW7HeH0.q83rkl.LUkNJObm7llTJ/3.ylNwEFm2', -- senha: @FDPfeioso90
  'Ricardo',
  'Administrador',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
);

-- Verificar se os usuários foram criados
SELECT 
  id, 
  email, 
  name, 
  role,
  is_active,
  can_access_dashboard,
  can_access_projects,
  can_access_briefings,
  can_access_codes,
  can_access_expenses,
  can_access_crm,
  can_access_users
FROM users 
WHERE email IN ('lucas@webdesign.com', 'ricardo@webdesign.com')
ORDER BY email;
```

### 2. Configuração das Variáveis de Ambiente no Vercel

Verifique se as seguintes variáveis estão configuradas no Vercel:

#### Variáveis Obrigatórias:
- `NODE_ENV=production`
- `SUPABASE_URL=sua_url_do_supabase`
- `SUPABASE_ANON_KEY=sua_chave_anonima`
- `SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role`
- `SUPABASE_JWT_SECRET=sua_jwt_secret`
- `SUPABASE_DB_HOST=db.sua_referencia.supabase.co`
- `SUPABASE_DB_PORT=5432`
- `SUPABASE_DB_NAME=postgres`
- `SUPABASE_DB_USER=postgres`
- `SUPABASE_DB_PASSWORD=sua_senha_do_banco`

#### Variáveis Opcionais:
- `JWT_EXPIRES_IN=24h`
- `BCRYPT_ROUNDS=10`
- `FRONTEND_URL=https://seu-dominio.vercel.app`
- `BACKEND_URL=https://seu-dominio.vercel.app/api`
- `CORS_ORIGIN=https://seu-dominio.vercel.app`

### 3. Deploy do Frontend

#### Mudanças Aplicadas:
✅ **Sidebar**: Removidas verificações de permissão - todos os usuários autenticados veem todos os itens do menu
✅ **ProtectedRoute**: Simplificado para verificar apenas autenticação, sem permissões específicas
✅ **Rotas**: Configuradas sem verificações de permissão específicas

#### Comando de Deploy:
```bash
# Se usando Vercel CLI
vercel --prod

# Ou faça push para a branch main se conectado ao GitHub
git add .
git commit -m "feat: remove frontend permission restrictions for production"
git push origin main
```

### 4. Verificação Pós-Deploy

#### Teste de Login:
1. **Usuário Lucas (Administrador)**:
   - Email: `lucas@webdesign.com`
   - Senha: `password`
   - Deve ter acesso total a todas as funcionalidades

2. **Usuário Ricardo (Usuário)**:
   - Email: `ricardo@webdesign.com`
   - Senha: `password`
   - Deve ter acesso a todas as funcionalidades (sem restrições no frontend)

#### Verificações:
- [ ] Login funciona para ambos os usuários
- [ ] Todos os itens do menu são visíveis
- [ ] Navegação entre páginas funciona
- [ ] Não há erros de permissão no console
- [ ] API de autenticação responde corretamente

### 5. Monitoramento

#### Logs para Verificar:
- Logs do Vercel para erros de deploy
- Logs do Supabase para conexões de banco
- Console do navegador para erros de frontend

#### URLs Importantes:
- Dashboard: `https://seu-dominio.vercel.app/`
- Login: `https://seu-dominio.vercel.app/login`
- API Health: `https://seu-dominio.vercel.app/api/`

## 🔧 Solução de Problemas

### Erro de Conexão com Banco
- Verificar variáveis `SUPABASE_DB_*`
- Confirmar que o IP do Vercel está liberado no Supabase
- Testar conexão direta no SQL Editor do Supabase

### Erro de Autenticação
- Verificar `SUPABASE_JWT_SECRET`
- Confirmar que os usuários foram criados corretamente
- Testar login diretamente na API: `POST /api/auth/login`

### Erro de CORS
- Verificar `CORS_ORIGIN` nas variáveis de ambiente
- Confirmar configuração no `vercel.json`

## 📝 Notas Importantes

1. **Senhas Padrão**: Ambos os usuários têm senha `password` - **ALTERE IMEDIATAMENTE** após o primeiro login
2. **Permissões**: O controle de acesso agora é feito apenas no painel administrativo, não no frontend
3. **Backup**: Sempre faça backup do banco antes de executar scripts em produção
4. **Segurança**: Mantenha as variáveis de ambiente seguras e nunca as exponha publicamente

---

**Data de Criação**: Janeiro 2025  
**Versão**: 1.0  
**Ambiente**: Produção Supabase + Vercel