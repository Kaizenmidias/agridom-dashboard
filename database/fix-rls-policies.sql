-- Script para corrigir políticas RLS (Row Level Security) no Supabase
-- Execute este script no SQL Editor do Supabase

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own codes" ON codes;
DROP POLICY IF EXISTS "Users can insert own codes" ON codes;
DROP POLICY IF EXISTS "Users can update own codes" ON codes;
DROP POLICY IF EXISTS "Users can delete own codes" ON codes;
DROP POLICY IF EXISTS "Users can view own briefings" ON briefings;
DROP POLICY IF EXISTS "Users can insert own briefings" ON briefings;
DROP POLICY IF EXISTS "Users can update own briefings" ON briefings;
DROP POLICY IF EXISTS "Users can delete own briefings" ON briefings;

-- Desabilitar RLS temporariamente para configurar
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE briefings DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- Criar função para verificar se o usuário é o dono do registro
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS INTEGER AS $$
BEGIN
  -- Para API externa, permitir acesso total
  -- O controle de acesso será feito na aplicação
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reabilitar RLS com políticas permissivas para API externa
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para permitir acesso via API
-- Usuários
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Projetos
CREATE POLICY "Allow all operations on projects" ON projects FOR ALL USING (true) WITH CHECK (true);

-- Despesas
CREATE POLICY "Allow all operations on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- Códigos
CREATE POLICY "Allow all operations on codes" ON codes FOR ALL USING (true) WITH CHECK (true);

-- Briefings
CREATE POLICY "Allow all operations on briefings" ON briefings FOR ALL USING (true) WITH CHECK (true);

-- Verificar se as políticas foram criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Mostrar status das tabelas com RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT 'Políticas RLS configuradas com sucesso!' as status;