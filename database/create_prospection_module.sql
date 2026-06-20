CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS prospects (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    normalized_business_name VARCHAR(255),
    category VARCHAR(150),
    address TEXT,
    city VARCHAR(150),
    state VARCHAR(80),
    phone VARCHAR(60),
    normalized_phone VARCHAR(40),
    email VARCHAR(255),
    website TEXT,
    normalized_website VARCHAR(255),
    google_maps_url TEXT,
    google_rating NUMERIC(3, 2),
    google_reviews INTEGER DEFAULT 0,
    instagram TEXT,
    facebook TEXT,
    website_exists BOOLEAN DEFAULT FALSE,
    pagespeed_mobile INTEGER,
    pagespeed_desktop INTEGER,
    seo_score INTEGER,
    lead_score INTEGER DEFAULT 0,
    website_quality VARCHAR(80),
    problems_found JSONB DEFAULT '[]'::jsonb,
    approach_suggestion TEXT,
    diagnostic_summary TEXT,
    analysis_report JSONB DEFAULT '{}'::jsonb,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(40) DEFAULT 'Novo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT prospects_status_check CHECK (
        status IN (
            'Novo',
            'Contato Enviado',
            'Respondeu',
            'Interessado',
            'Reuniao Agendada',
            'Proposta Enviada',
            'Fechado',
            'Perdido'
        )
    ),
    CONSTRAINT prospects_score_check CHECK (lead_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS prospect_contact_history (
    id BIGSERIAL PRIMARY KEY,
    prospect_id BIGINT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    recipient VARCHAR(255),
    delivery_status VARCHAR(40) DEFAULT 'registrado',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT prospect_contact_history_channel_check CHECK (
        channel IN ('whatsapp', 'email', 'crm', 'system')
    )
);

CREATE TABLE IF NOT EXISTS prospecting_settings (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_template TEXT DEFAULT 'Oi {{nome}}, tudo bem? Analisei {{empresa}} em {{cidade}} e identifiquei uma oportunidade de melhoria em {{problema}}. Hoje o lead score esta em {{score}}. Posso te mostrar algumas melhorias praticas?',
    email_subject VARCHAR(255) DEFAULT 'Oportunidade de melhoria digital para {{empresa}}',
    email_body_html TEXT DEFAULT '<p>Oi {{nome}}, tudo bem?</p><p>Analisei a presença digital da <strong>{{empresa}}</strong> em {{cidade}} e identifiquei um ponto importante em {{problema}}.</p><p>Hoje o lead score está em <strong>{{score}}</strong>.</p><p>Se quiser, posso te mostrar melhorias práticas para aumentar a geração de contatos.</p>',
    sender_name VARCHAR(150) DEFAULT 'Kaizen',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_owner_user_id ON prospects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_category ON prospects(category);
CREATE INDEX IF NOT EXISTS idx_prospects_city_state ON prospects(city, state);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_history_prospect_id ON prospect_contact_history(prospect_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_channel ON prospect_contact_history(channel);
CREATE INDEX IF NOT EXISTS idx_contact_history_created_at ON prospect_contact_history(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prospects_owner_phone
ON prospects(owner_user_id, normalized_phone)
WHERE normalized_phone IS NOT NULL AND normalized_phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_prospects_owner_website
ON prospects(owner_user_id, normalized_website)
WHERE normalized_website IS NOT NULL AND normalized_website <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_prospects_owner_business_name
ON prospects(owner_user_id, normalized_business_name)
WHERE normalized_business_name IS NOT NULL AND normalized_business_name <> '';

DROP TRIGGER IF EXISTS update_prospects_updated_at ON prospects;
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON prospects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospecting_settings_updated_at ON prospecting_settings;
CREATE TRIGGER update_prospecting_settings_updated_at
BEFORE UPDATE ON prospecting_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view prospects" ON prospects;
CREATE POLICY "Authenticated users can view prospects" ON prospects
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert prospects" ON prospects;
CREATE POLICY "Authenticated users can insert prospects" ON prospects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update prospects" ON prospects;
CREATE POLICY "Authenticated users can update prospects" ON prospects
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete prospects" ON prospects;
CREATE POLICY "Authenticated users can delete prospects" ON prospects
    FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view prospect contact history" ON prospect_contact_history;
CREATE POLICY "Authenticated users can view prospect contact history" ON prospect_contact_history
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert prospect contact history" ON prospect_contact_history;
CREATE POLICY "Authenticated users can insert prospect contact history" ON prospect_contact_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view prospecting settings" ON prospecting_settings;
CREATE POLICY "Authenticated users can view prospecting settings" ON prospecting_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert prospecting settings" ON prospecting_settings;
CREATE POLICY "Authenticated users can insert prospecting settings" ON prospecting_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update prospecting settings" ON prospecting_settings;
CREATE POLICY "Authenticated users can update prospecting settings" ON prospecting_settings
    FOR UPDATE USING (auth.role() = 'authenticated');
