CREATE TABLE abha_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    abha_address TEXT NOT NULL,
    abha_number TEXT NOT NULL,
    encrypted_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

CREATE TABLE abha_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    abha_link_id UUID REFERENCES abha_links(id),
    record_type TEXT NOT NULL CHECK (
        record_type IN ('verification', 'prescription')
    ),
    record_data JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);