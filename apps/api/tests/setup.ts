process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.API_SECRET_KEY = "test-secret-key";

// Register a dummy WebSocket implementation to bypass Node 20 Supabase initialization crash
(global as any).WebSocket = class {};
