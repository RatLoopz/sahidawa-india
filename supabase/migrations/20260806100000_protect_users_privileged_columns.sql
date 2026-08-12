-- Prevent authenticated clients from escalating role / points / badges on
-- public.users. Profile self-updates may still change display fields only;
-- privileged columns are owned by service_role / SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.protect_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only clamp browser/client roles. service_role, postgres, and migrations
    -- may mint points or promote roles intentionally.
    IF coalesce(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.role := 'user';
        NEW.points := 0;
        NEW.badges := '{}'::text[];
        RETURN NEW;
    END IF;

    -- UPDATE: always preserve privileged columns from the existing row.
    NEW.role := OLD.role;
    NEW.points := OLD.points;
    NEW.badges := OLD.badges;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_users_privileged_columns ON public.users;

CREATE TRIGGER protect_users_privileged_columns
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_users_privileged_columns();

-- Tighten INSERT so a crafted row cannot satisfy RLS with elevated values
-- even before the trigger runs (defense in depth).
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert their own profile"
    ON public.users
    FOR INSERT
    WITH CHECK (
        auth.uid() = id
        AND role = 'user'
        AND points = 0
        AND coalesce(badges, '{}'::text[]) = '{}'::text[]
    );

-- Explicit service_role write access for API award/promotion paths.
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

CREATE POLICY "Service role can manage users"
    ON public.users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
