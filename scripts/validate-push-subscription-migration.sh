#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
CONTAINER_NAME="${CONTAINER_NAME:-sahidawa-push-subscription-migration-$$}"

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for this migration validation." >&2
    exit 1
fi

cleanup() {
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_PASSWORD=postgres \
    -d "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 30); do
    if docker exec "$CONTAINER_NAME" psql -X -q -U postgres -d postgres -c "SELECT 1" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

docker exec "$CONTAINER_NAME" psql -X -q -U postgres -d postgres -c "SELECT 1" >/dev/null
echo "postgres: ready ($POSTGRES_IMAGE)"

docker exec -i "$CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY
);

DO $$
BEGIN
    CREATE ROLE anon NOLOGIN;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE ROLE authenticated NOLOGIN;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE ROLE service_role NOLOGIN;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
SQL
echo "setup: created minimal Supabase auth shims"

docker exec -i "$CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$ROOT_DIR/supabase/migrations/20260518000000_create_push_subscriptions.sql"
echo "migration: applied 20260518000000_create_push_subscriptions.sql"

docker exec -i "$CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
INSERT INTO public.push_subscriptions (endpoint, subscription)
VALUES (
    'https://push.example.test/legacy',
    '{"endpoint":"https://push.example.test/legacy","keys":{"p256dh":"legacy-key","auth":"legacy-auth"}}'::jsonb
);

SELECT 'legacy rows before ownership migration: ' || COUNT(*)
FROM public.push_subscriptions;
SQL
echo "fixture: inserted one legacy ownerless subscription"

docker exec -i "$CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$ROOT_DIR/supabase/migrations/20260601000000_add_push_subscriptions_user_id_and_rls.sql"
echo "migration: applied 20260601000000_add_push_subscriptions_user_id_and_rls.sql"

docker exec -i "$CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$
DECLARE
    remaining_legacy INTEGER;
    user_id_not_null BOOLEAN;
    user_fk_exists BOOLEAN;
    user_policy_exists BOOLEAN;
BEGIN
    SELECT COUNT(*)
    INTO remaining_legacy
    FROM public.push_subscriptions
    WHERE user_id IS NULL;

    IF remaining_legacy <> 0 THEN
        RAISE EXCEPTION 'expected 0 ownerless rows after migration, found %', remaining_legacy;
    END IF;

    SELECT attnotnull
    INTO user_id_not_null
    FROM pg_attribute
    WHERE attrelid = 'public.push_subscriptions'::regclass
      AND attname = 'user_id'
      AND NOT attisdropped;

    IF user_id_not_null IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'push_subscriptions.user_id is not NOT NULL';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'push_subscriptions_user_id_fkey'
          AND conrelid = 'public.push_subscriptions'::regclass
          AND contype = 'f'
    )
    INTO user_fk_exists;

    IF user_fk_exists IS NOT TRUE THEN
        RAISE EXCEPTION 'push_subscriptions.user_id foreign key is missing';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'push_subscriptions'
          AND policyname = 'push_subscriptions_user_all'
    )
    INTO user_policy_exists;

    IF user_policy_exists IS NOT TRUE THEN
        RAISE EXCEPTION 'push_subscriptions_user_all policy is missing';
    END IF;
END $$;

INSERT INTO auth.users (id)
VALUES ('00000000-0000-0000-0000-000000000001');

INSERT INTO public.push_subscriptions (endpoint, subscription, user_id)
VALUES (
    'https://push.example.test/owned',
    '{"endpoint":"https://push.example.test/owned","keys":{"p256dh":"owned-key","auth":"owned-auth"}}'::jsonb,
    '00000000-0000-0000-0000-000000000001'
);

SELECT 'owned rows after migration: ' || COUNT(*)
FROM public.push_subscriptions;
SQL

echo "validation: legacy row cleaned, user_id NOT NULL, FK and RLS policy present"
