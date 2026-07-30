-- Proposed migration for Comercial -> Prospeccao v2.
-- Review and execute manually in Supabase after confirming existing data and RLS expectations.

CREATE TABLE IF NOT EXISTS integration_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(80) UNIQUE NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
    configuration_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT integration_providers_status_check CHECK (
        status IN ('not_configured', 'configured', 'connected', 'auth_error', 'provider_error')
    )
);

CREATE TABLE IF NOT EXISTS cnae_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL,
    formatted_code VARCHAR(24) NOT NULL,
    description TEXT NOT NULL,
    section VARCHAR(120),
    division VARCHAR(20),
    "group" VARCHAR(20),
    class VARCHAR(20),
    subclass VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cnae_codes_code ON cnae_codes(code);
CREATE INDEX IF NOT EXISTS idx_cnae_codes_description ON cnae_codes USING gin(to_tsvector('portuguese', description));
CREATE INDEX IF NOT EXISTS idx_cnae_codes_active ON cnae_codes(is_active);

CREATE TABLE IF NOT EXISTS prospecting_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    search_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_quantity INTEGER NOT NULL DEFAULT 10,
    processed_count INTEGER NOT NULL DEFAULT 0,
    found_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    invalid_count INTEGER NOT NULL DEFAULT 0,
    external_run_id TEXT,
    external_dataset_id TEXT,
    integration_provider VARCHAR(80),
    credits_estimated INTEGER,
    credits_consumed INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT prospecting_jobs_source_check CHECK (source IN ('google_maps', 'cnpj', 'instagram')),
    CONSTRAINT prospecting_jobs_status_check CHECK (
        status IN (
            'draft',
            'queued',
            'running',
            'collecting',
            'normalizing',
            'validating',
            'completed',
            'partially_completed',
            'failed',
            'cancelled'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_prospecting_jobs_status ON prospecting_jobs(status);
CREATE INDEX IF NOT EXISTS idx_prospecting_jobs_created_by ON prospecting_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_prospecting_jobs_created_at ON prospecting_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS prospecting_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES prospecting_jobs(id) ON DELETE CASCADE,
    source VARCHAR(40) NOT NULL,
    external_id TEXT,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    legal_name TEXT,
    contact_name TEXT,
    category TEXT,
    cnpj VARCHAR(20),
    normalized_cnpj VARCHAR(14),
    phone TEXT,
    normalized_phone VARCHAR(20),
    whatsapp TEXT,
    whatsapp_status VARCHAR(40) NOT NULL DEFAULT 'not_checked',
    email TEXT,
    normalized_email TEXT,
    secondary_email TEXT,
    website TEXT,
    normalized_website_domain TEXT,
    instagram_username TEXT,
    instagram_url TEXT,
    address TEXT,
    neighborhood TEXT,
    city TEXT,
    state VARCHAR(2),
    postal_code TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    rating NUMERIC(3, 2),
    review_count INTEGER,
    cnae_primary TEXT,
    cnae_secondary JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_payload JSONB,
    duplicate_status VARCHAR(40) NOT NULL DEFAULT 'new',
    duplicate_lead_id TEXT,
    duplicate_reason TEXT,
    validation_status VARCHAR(40) NOT NULL DEFAULT 'valid',
    selected BOOLEAN NOT NULL DEFAULT FALSE,
    imported_to_leads_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT prospecting_results_source_check CHECK (source IN ('google_maps', 'cnpj', 'instagram')),
    CONSTRAINT prospecting_results_duplicate_check CHECK (duplicate_status IN ('new', 'duplicate', 'possible_duplicate')),
    CONSTRAINT prospecting_results_whatsapp_check CHECK (
        whatsapp_status IN ('valid', 'invalid', 'unknown', 'not_checked', 'provider_error')
    )
);

CREATE INDEX IF NOT EXISTS idx_prospecting_results_job_id ON prospecting_results(job_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_duplicate_status ON prospecting_results(duplicate_status);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_normalized_cnpj ON prospecting_results(normalized_cnpj);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_normalized_phone ON prospecting_results(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_normalized_email ON prospecting_results(normalized_email);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_website_domain ON prospecting_results(normalized_website_domain);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_instagram_username ON prospecting_results(instagram_username);

CREATE TABLE IF NOT EXISTS prospecting_job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES prospecting_jobs(id) ON DELETE CASCADE,
    event_type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospecting_job_events_job_id ON prospecting_job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_job_events_created_at ON prospecting_job_events(created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_validation_cache (
    normalized_phone VARCHAR(20) PRIMARY KEY,
    status VARCHAR(40) NOT NULL,
    provider VARCHAR(80),
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    raw_response JSONB,
    CONSTRAINT whatsapp_validation_cache_status_check CHECK (
        status IN ('valid', 'invalid', 'unknown', 'not_checked', 'provider_error')
    )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_validation_cache_expires_at ON whatsapp_validation_cache(expires_at);

DROP TRIGGER IF EXISTS update_integration_providers_updated_at ON integration_providers;
CREATE TRIGGER update_integration_providers_updated_at
BEFORE UPDATE ON integration_providers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cnae_codes_updated_at ON cnae_codes;
CREATE TRIGGER update_cnae_codes_updated_at
BEFORE UPDATE ON cnae_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospecting_jobs_updated_at ON prospecting_jobs;
CREATE TRIGGER update_prospecting_jobs_updated_at
BEFORE UPDATE ON prospecting_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospecting_results_updated_at ON prospecting_results;
CREATE TRIGGER update_prospecting_results_updated_at
BEFORE UPDATE ON prospecting_results
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnae_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_validation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view integration metadata" ON integration_providers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view cnaes" ON cnae_codes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view prospecting jobs" ON prospecting_jobs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prospecting jobs" ON prospecting_jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prospecting jobs" ON prospecting_jobs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view prospecting results" ON prospecting_results
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prospecting results" ON prospecting_results
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prospecting results" ON prospecting_results
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view prospecting events" ON prospecting_job_events
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prospecting events" ON prospecting_job_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view whatsapp cache" ON whatsapp_validation_cache
    FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO integration_providers (provider, display_name, status, configuration_metadata)
VALUES
    ('apify', 'Apify', 'not_configured', '{"googleMapsActorId":"", "instagramActorId":"", "timeoutMinutes":10, "pollIntervalSeconds":5}'::jsonb),
    ('casa_dos_dados', 'Casa dos Dados', 'not_configured', '{"apiVersion":"v5", "baseUrl":"https://api.casadosdados.com.br"}'::jsonb),
    ('whatsapp_validator', 'Validacao de WhatsApp', 'not_configured', '{"provider":"", "cacheDays":30}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

