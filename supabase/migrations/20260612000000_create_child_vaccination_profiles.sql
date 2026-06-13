CREATE TABLE IF NOT EXISTS public.child_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 80 AND btrim(name) <> ''),
    date_of_birth DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT child_profiles_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.child_completed_vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    dose_id TEXT NOT NULL CHECK (btrim(dose_id) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT child_completed_vaccinations_profile_dose_key UNIQUE (child_profile_id, dose_id)
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id
ON public.child_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_child_completed_vaccinations_profile_id
ON public.child_completed_vaccinations(child_profile_id);

CREATE INDEX IF NOT EXISTS idx_child_completed_vaccinations_dose_id
ON public.child_completed_vaccinations(dose_id);

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_completed_vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_profiles_select_own"
ON public.child_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "child_profiles_insert_own"
ON public.child_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "child_profiles_update_own"
ON public.child_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "child_profiles_delete_own"
ON public.child_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "child_completed_vaccinations_select_own"
ON public.child_completed_vaccinations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.child_profiles
        WHERE child_profiles.id = child_completed_vaccinations.child_profile_id
          AND child_profiles.user_id = auth.uid()
    )
);

CREATE POLICY "child_completed_vaccinations_insert_own"
ON public.child_completed_vaccinations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.child_profiles
        WHERE child_profiles.id = child_completed_vaccinations.child_profile_id
          AND child_profiles.user_id = auth.uid()
    )
);

CREATE POLICY "child_completed_vaccinations_update_own"
ON public.child_completed_vaccinations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.child_profiles
        WHERE child_profiles.id = child_completed_vaccinations.child_profile_id
          AND child_profiles.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.child_profiles
        WHERE child_profiles.id = child_completed_vaccinations.child_profile_id
          AND child_profiles.user_id = auth.uid()
    )
);

CREATE POLICY "child_completed_vaccinations_delete_own"
ON public.child_completed_vaccinations
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.child_profiles
        WHERE child_profiles.id = child_completed_vaccinations.child_profile_id
          AND child_profiles.user_id = auth.uid()
    )
);
