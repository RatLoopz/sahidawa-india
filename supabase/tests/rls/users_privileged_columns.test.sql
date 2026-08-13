BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(5);

-- --------------------------------------------------------------------
-- Create test user
-- --------------------------------------------------------------------

DELETE FROM public.users
WHERE id = 'cccccccc-0000-4000-8000-000000000003';

DELETE FROM auth.users
WHERE id = 'cccccccc-0000-4000-8000-000000000003';

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES
(
    '00000000-0000-0000-0000-000000000000',
    'cccccccc-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'pgtap-users-priv@test.local',
    '',
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
);

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        'cccccccc-0000-4000-8000-000000000003',
        'role',
        'authenticated'
    )::text,
    true
);

SET LOCAL ROLE authenticated;

-- Insert with attempted privilege escalation must land as default user/0 pts
SELECT lives_ok(
    $$
    INSERT INTO public.users (id, full_name, role, points, badges)
    VALUES (
        'cccccccc-0000-4000-8000-000000000003',
        'Escalation Attempt',
        'admin',
        9999,
        ARRAY['god_mode']
    );
    $$,
    'Authenticated user can insert own profile row'
);

SELECT is(
    (SELECT role FROM public.users WHERE id = 'cccccccc-0000-4000-8000-000000000003'),
    'user',
    'Insert cannot set elevated role'
);

SELECT is(
    (SELECT points FROM public.users WHERE id = 'cccccccc-0000-4000-8000-000000000003'),
    0,
    'Insert cannot set inflated points'
);

-- Profile display update allowed; privileged columns stay put
UPDATE public.users
SET full_name = 'Safe Name',
    role = 'admin',
    points = 50000,
    badges = ARRAY['hacked']
WHERE id = 'cccccccc-0000-4000-8000-000000000003';

SELECT is(
    (SELECT full_name FROM public.users WHERE id = 'cccccccc-0000-4000-8000-000000000003'),
    'Safe Name',
    'User can update display fields'
);

SELECT results_eq(
    $$
    SELECT role, points, badges
    FROM public.users
    WHERE id = 'cccccccc-0000-4000-8000-000000000003'
    $$,
    $$
    VALUES ('user'::varchar(50), 0, '{}'::text[])
    $$,
    'Update cannot escalate role, points, or badges'
);

SELECT * FROM finish();

ROLLBACK;
