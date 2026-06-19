CREATE TABLE abha_links (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        REFERENCES auth.users(id) UNIQUE NOT NULL,
    abha_address   TEXT        NOT NULL,
    abha_number    TEXT        NOT NULL,
    encrypted_token TEXT       NOT NULL,
    encryption_iv  TEXT        NOT NULL, 
    is_active      BOOLEAN     DEFAULT TRUE,
    linked_at      TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

CREATE TABLE abha_records (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        REFERENCES auth.users(id) NOT NULL,
    abha_link_id UUID        REFERENCES abha_links(id),
    record_type  TEXT        NOT NULL CHECK (record_type IN ('verification', 'prescription')),
    record_data  JSONB       NOT NULL,
    synced_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abha_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE abha_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_abha_links"
    ON abha_links FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "users_own_abha_records"
    ON abha_records FOR ALL
    USING (auth.uid() = user_id);

CREATE TABLE abha_audit_log (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES auth.users(id) NOT NULL,
    action     TEXT        NOT NULL CHECK (action IN ('LINKED', 'UNLINKED', 'UPLOAD', 'SYNC')),
    status     TEXT        NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abha_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_audit_log"
    ON abha_audit_log FOR ALL
    USING (auth.uid() = user_id);