# 🔧 Instruções para Corrigir Permissões do Administrador

## Problema
O usuário administrador não consegue acessar o dashboard mesmo após login bem-sucedido.

## Solução

### Passo 1: Executar Script SQL no Supabase

1. **Acesse o painel do Supabase:**
   - Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Faça login na sua conta
   - Selecione seu projeto

2. **Abra o SQL Editor:**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Execute o script de correção:**
   ```sql
   -- Verificar estado atual do usuário
   SELECT 
       email,
       name,
       role,
       is_active,
       can_access_dashboard,
       can_access_briefings,
       can_access_codes,
       can_access_projects,
       can_access_expenses,
       can_access_crm,
       can_access_users
   FROM users 
   WHERE email = 'admin@webdesign.com';

   -- Forçar atualização das permissões
   UPDATE users 
   SET 
       can_access_dashboard = TRUE,
       can_access_briefings = TRUE,
       can_access_codes = TRUE,
       can_access_projects = TRUE,
       can_access_expenses = TRUE,
       can_access_crm = TRUE,
       can_access_users = TRUE,
       role = 'admin',
       is_active = TRUE,
       updated_at = NOW()
   WHERE email = 'admin@webdesign.com';

   -- Verificar se funcionou
   SELECT 
       email,
       role,
       is_active,
       can_access_dashboard,
       can_access_users,
       updated_at
   FROM users 
   WHERE email = 'admin@webdesign.com';
   ```

4. **Clique em "Run" para executar**

### Passo 2: Forçar Atualização no Frontend

**Opção A - Aguardar (Recomendado):**
- Aguarde até 30 segundos
- O sistema verifica automaticamente mudanças de permissão
- Recarregue a página se necessário

**Opção B - Logout/Login:**
- Faça logout do sistema
- Faça login novamente com:
  - **Email:** admin@webdesign.com
  - **Senha:** admin123

### Passo 3: Verificar Acesso

1. Após o login, você deve ter acesso a:
   - ✅ Dashboard principal
   - ✅ Gestão de usuários
   - ✅ Todos os módulos do sistema

2. Se ainda não funcionar:
   - Abra o console do navegador (F12)
   - Procure por erros ou mensagens
   - Verifique se o script SQL foi executado corretamente

## Scripts Disponíveis

- `fix_admin_user.sql` - Script completo de correção
- `update_admin_permissions.sql` - Script baseado em cargo
- `check_admin_roles.sql` - Script para verificar cargos

## Observações Importantes

- ⚠️ **Altere a senha padrão** após o primeiro acesso
- 🔄 O sistema verifica permissões automaticamente a cada 30 segundos
- 🎯 As permissões são baseadas no cargo 'admin' no banco de dados
- 📧 Mudanças de email não afetam as permissões (baseadas no cargo)

## Suporte

Se o problema persistir:
1. Verifique se o banco de dados está acessível
2. Confirme se o script SQL foi executado sem erros
3. Verifique os logs do console do navegador
4. Teste com um novo usuário administrador