-- Script para aplicar políticas RLS corretas no Supabase
-- Execute este script no SQL Editor do Supabase

-- ========================================
-- POLÍTICAS PARA TABELA PROJECTS
-- ========================================

-- Remove políticas existentes se houver
DROP POLICY IF EXISTS "allow anon select projects" ON projects;
DROP POLICY IF EXISTS "allow anon insert projects" ON projects;
DROP POLICY IF EXISTS "allow anon update projects" ON projects;
DROP POLICY IF EXISTS "allow anon delete projects" ON projects;

-- Cria políticas para permitir acesso total à role anon
CREATE POLICY "allow anon select projects" ON projects
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert projects" ON projects
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update projects" ON projects
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete projects" ON projects
  FOR DELETE TO anon USING (true);

-- ========================================
-- POLÍTICAS PARA TABELA CODES
-- ========================================

-- Remove políticas existentes se houver
DROP POLICY IF EXISTS "allow anon select codes" ON codes;
DROP POLICY IF EXISTS "allow anon insert codes" ON codes;
DROP POLICY IF EXISTS "allow anon update codes" ON codes;
DROP POLICY IF EXISTS "allow anon delete codes" ON codes;

-- Cria políticas para permitir acesso total à role anon
CREATE POLICY "allow anon select codes" ON codes
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert codes" ON codes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update codes" ON codes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete codes" ON codes
  FOR DELETE TO anon USING (true);

-- ========================================
-- POLÍTICAS PARA TABELA EXPENSES
-- ========================================

-- Remove políticas existentes se houver
DROP POLICY IF EXISTS "allow anon select expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon insert expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon update expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon delete expenses" ON expenses;

-- Cria políticas para permitir acesso total à role anon
CREATE POLICY "allow anon select expenses" ON expenses
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert expenses" ON expenses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update expenses" ON expenses
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete expenses" ON expenses
  FOR DELETE TO anon USING (true);

-- ========================================
-- POLÍTICAS PARA TABELA USERS (se necessário)
-- ========================================

-- Remove políticas existentes se houver
DROP POLICY IF EXISTS "allow anon select users" ON users;
DROP POLICY IF EXISTS "allow anon insert users" ON users;
DROP POLICY IF EXISTS "allow anon update users" ON users;
DROP POLICY IF EXISTS "allow anon delete users" ON users;

-- Cria políticas para permitir acesso total à role anon
CREATE POLICY "allow anon select users" ON users
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert users" ON users
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update users" ON users
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete users" ON users
  FOR DELETE TO anon USING (true);

-- ========================================
-- VERIFICAÇÃO DAS POLÍTICAS CRIADAS
-- ========================================

-- Verifica se as políticas foram criadas corretamente
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
WHERE tablename IN ('projects', 'codes', 'expenses', 'users')
ORDER BY tablename, policyname;

-- ========================================
-- TESTE DAS POLÍTICAS
-- ========================================

-- Teste básico de SELECT (deve retornar dados)
SELECT 'projects' as tabela, count(*) as total FROM projects
UNION ALL
SELECT 'codes' as tabela, count(*) as total FROM codes
UNION ALL
SELECT 'expenses' as tabela, count(*) as total FROM expenses
UNION ALL
SELECT 'users' as tabela, count(*) as total FROM users;

-- Mensagem de sucesso
SELECT 'Políticas RLS aplicadas com sucesso! Agora a role anon tem acesso total às tabelas.' as status;