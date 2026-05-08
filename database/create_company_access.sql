-- Tabela de acessos das empresas
CREATE TABLE IF NOT EXISTS company_access (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    wordpress_url VARCHAR(255),
    wordpress_login VARCHAR(255),
    wordpress_password VARCHAR(255),
    domain_url VARCHAR(255),
    domain_login VARCHAR(255),
    domain_password VARCHAR(255),
    hosting_url VARCHAR(255),
    hosting_login VARCHAR(255),
    hosting_password VARCHAR(255),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para company_access
CREATE INDEX IF NOT EXISTS idx_company_access_user_id ON company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_company_access_company_name ON company_access(company_name);
CREATE INDEX IF NOT EXISTS idx_company_access_created_at ON company_access(created_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_company_access_updated_at ON company_access;
CREATE TRIGGER update_company_access_updated_at BEFORE UPDATE ON company_access FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (opcional, dependendo da configuração do projeto)
ALTER TABLE company_access ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Usuários podem ver seus próprios acessos" ON company_access;
CREATE POLICY "Usuários podem ver seus próprios acessos" ON company_access
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem inserir seus próprios acessos" ON company_access;
CREATE POLICY "Usuários podem inserir seus próprios acessos" ON company_access
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios acessos" ON company_access;
CREATE POLICY "Usuários podem atualizar seus próprios acessos" ON company_access
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem deletar seus próprios acessos" ON company_access;
CREATE POLICY "Usuários podem deletar seus próprios acessos" ON company_access
    FOR DELETE USING (auth.role() = 'authenticated');
