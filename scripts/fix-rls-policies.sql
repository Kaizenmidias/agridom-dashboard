-- Script para corrigir as policies RLS no Supabase
-- Execute este script no SQL Editor do Supabase

-- ========================================
-- TABELA PROJECTS
-- ========================================

-- Remove policies existentes
DROP POLICY IF EXISTS "allow anon select projects" ON projects;
DROP POLICY IF EXISTS "allow anon insert projects" ON projects;
DROP POLICY IF EXISTS "allow anon update projects" ON projects;
DROP POLICY IF EXISTS "allow anon delete projects" ON projects;

-- Cria policies para anon role
CREATE POLICY "allow anon select projects" ON projects
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert projects" ON projects
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update projects" ON projects
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete projects" ON projects
  FOR DELETE TO anon USING (true);

-- ========================================
-- TABELA CODES
-- ========================================

-- Remove policies existentes
DROP POLICY IF EXISTS "allow anon select codes" ON codes;
DROP POLICY IF EXISTS "allow anon insert codes" ON codes;
DROP POLICY IF EXISTS "allow anon update codes" ON codes;
DROP POLICY IF EXISTS "allow anon delete codes" ON codes;

-- Cria policies para anon role
CREATE POLICY "allow anon select codes" ON codes
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert codes" ON codes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update codes" ON codes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete codes" ON codes
  FOR DELETE TO anon USING (true);

-- ========================================
-- TABELA EXPENSES
-- ========================================

-- Remove policies existentes
DROP POLICY IF EXISTS "allow anon select expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon insert expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon update expenses" ON expenses;
DROP POLICY IF EXISTS "allow anon delete expenses" ON expenses;

-- Cria policies para anon role
CREATE POLICY "allow anon select expenses" ON expenses
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow anon insert expenses" ON expenses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow anon update expenses" ON expenses
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow anon delete expenses" ON expenses
  FOR DELETE TO anon USING (true);

-- ========================================
-- VERIFICAÇÃO DAS POLICIES
-- ========================================

-- Verifica se as policies foram criadas corretamente
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
WHERE tablename IN ('projects', 'codes', 'expenses')
ORDER BY tablename, policyname;

-- ========================================
-- TESTE DAS PERMISSIONS
-- ========================================

-- Testa se a role anon consegue acessar as tabelas
-- (Execute estes comandos separadamente para testar)

-- SET ROLE anon;
-- SELECT COUNT(*) FROM projects;
-- SELECT COUNT(*) FROM codes;
-- SELECT COUNT(*) FROM expenses;
-- RESET ROLE;