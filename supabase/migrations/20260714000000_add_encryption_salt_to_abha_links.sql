ALTER TABLE abha_links
    ADD COLUMN encryption_salt TEXT NOT NULL DEFAULT 'migrated';

COMMENT ON COLUMN abha_links.encryption_salt IS 'Per-record random salt used in scrypt key derivation for AES-256-CBC token encryption. Each link gets a unique salt.';
