-- ===========================================
-- CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS)
-- ===========================================
-- Este script configura as policies RLS para permitir acesso anônimo
-- às tabelas projects, expenses e codes em produção

-- Habilitar RLS nas tabelas (se ainda não estiver habilitado)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- POLICIES PARA TABELA PROJECTS
-- ===========================================

-- Permitir SELECT para todos (anônimo e autenticado)
CREATE POLICY "Allow public read access on projects" ON projects
  FOR SELECT
  USING (true);

-- Permitir INSERT para todos
CREATE POLICY "Allow public insert access on projects" ON projects
  FOR INSERT
  WITH CHECK (true);

-- Permitir UPDATE para todos
CREATE POLICY "Allow public update access on projects" ON projects
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permitir DELETE para todos
CREATE POLICY "Allow public delete access on projects" ON projects
  FOR DELETE
  USING (true);

-- ===========================================
-- POLICIES PARA TABELA EXPENSES
-- ===========================================

-- Permitir SELECT para todos (anônimo e autenticado)
CREATE POLICY "Allow public read access on expenses" ON expenses
  FOR SELECT
  USING (true);

-- Permitir INSERT para todos
CREATE POLICY "Allow public insert access on expenses" ON expenses
  FOR INSERT
  WITH CHECK (true);

-- Permitir UPDATE para todos
CREATE POLICY "Allow public update access on expenses" ON expenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permitir DELETE para todos
CREATE POLICY "Allow public delete access on expenses" ON expenses
  FOR DELETE
  USING (true);

-- ===========================================
-- POLICIES PARA TABELA CODES
-- ===========================================

-- Permitir SELECT para todos (anônimo e autenticado)
CREATE POLICY "Allow public read access on codes" ON codes
  FOR SELECT
  USING (true);

-- Permitir INSERT para todos
CREATE POLICY "Allow public insert access on codes" ON codes
  FOR INSERT
  WITH CHECK (true);

-- Permitir UPDATE para todos
CREATE POLICY "Allow public update access on codes" ON codes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permitir DELETE para todos
CREATE POLICY "Allow public delete access on codes" ON codes
  FOR DELETE
  USING (true);

-- ===========================================
-- VERIFICAÇÃO DAS POLICIES CRIADAS
-- ===========================================

-- Listar todas as policies criadas
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
WHERE tablename IN ('projects', 'expenses', 'codes')
ORDER BY tablename, policyname;

-- Verificar se RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename IN ('projects', 'expenses', 'codes')
ORDER BY tablename;