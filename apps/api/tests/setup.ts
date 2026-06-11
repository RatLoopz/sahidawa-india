process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ML_SERVICE_URL = "http://example.com";
process.env.API_SECRET_KEY = "test-secret-key";
process.env.CSRF_SECRET = "test-csrf-secret-key-32-chars-long-or-more";
// Register a dummy WebSocket implementation to bypass Node 20 Supabase initialization crash
(global as any).WebSocket = class {};
