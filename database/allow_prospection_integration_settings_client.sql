-- Permite que o frontend salve configuracoes de integracoes quando o dominio
-- nao esta servindo as rotas /api/prospection/*.
-- A politica fica restrita a chave do usuario autenticado.

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view own prospection integrations" ON system_settings;
CREATE POLICY "Authenticated users can view own prospection integrations"
ON system_settings
FOR SELECT
USING (
  setting_key = (
    'prospection_integrations_user_' ||
    COALESCE(
      (
        SELECT users.id::text
        FROM users
        WHERE users.email = auth.jwt() ->> 'email'
        LIMIT 1
      ),
      auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert own prospection integrations" ON system_settings;
CREATE POLICY "Authenticated users can insert own prospection integrations"
ON system_settings
FOR INSERT
WITH CHECK (
  setting_key = (
    'prospection_integrations_user_' ||
    COALESCE(
      (
        SELECT users.id::text
        FROM users
        WHERE users.email = auth.jwt() ->> 'email'
        LIMIT 1
      ),
      auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can update own prospection integrations" ON system_settings;
CREATE POLICY "Authenticated users can update own prospection integrations"
ON system_settings
FOR UPDATE
USING (
  setting_key = (
    'prospection_integrations_user_' ||
    COALESCE(
      (
        SELECT users.id::text
        FROM users
        WHERE users.email = auth.jwt() ->> 'email'
        LIMIT 1
      ),
      auth.uid()::text
    )
  )
)
WITH CHECK (
  setting_key = (
    'prospection_integrations_user_' ||
    COALESCE(
      (
        SELECT users.id::text
        FROM users
        WHERE users.email = auth.jwt() ->> 'email'
        LIMIT 1
      ),
      auth.uid()::text
    )
  )
);
