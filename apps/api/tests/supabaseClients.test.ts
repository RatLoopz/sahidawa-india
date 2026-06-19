describe("Supabase client permission boundaries", () => {
    const mockCreateClient = jest.fn();
    const mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.SUPABASE_URL = "http://localhost:54321";
        process.env.SUPABASE_ANON_KEY = "test-anon-key";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    });

    function setupModuleMocks() {
        jest.doMock("@supabase/supabase-js", () => ({
            createClient: mockCreateClient,
        }));
        jest.doMock("../src/utils/logger", () => ({
            __esModule: true,
            default: mockLogger,
        }));
        jest.doMock("../src/db/fetchUtils", () => ({
            CONNECTION_TIMEOUT_MS: 1000,
            MAX_RETRIES: 1,
            RETRY_DELAY_MS: 1,
            fetchWithRetry: jest.fn(),
        }));
    }

    it("initializes the privileged client with the service-role key", () => {
        const setIntervalSpy = jest
            .spyOn(global, "setInterval")
            .mockImplementation(() => 0 as unknown as NodeJS.Timeout);
        const processOnSpy = jest.spyOn(process, "on").mockReturnValue(process);
        setupModuleMocks();

        const privilegedClient = { auth: {}, from: jest.fn() };
        mockCreateClient.mockReturnValue(privilegedClient);

        let exports: typeof import("../src/db/client");
        jest.isolateModules(() => {
            exports = require("../src/db/client");
        });

        expect(exports!.serviceRoleSupabase).toBe(privilegedClient);
        expect(exports!.supabase).toBe(privilegedClient);
        expect(mockCreateClient).toHaveBeenCalledWith(
            "http://localhost:54321",
            "test-service-role-key",
            expect.objectContaining({
                auth: expect.objectContaining({
                    autoRefreshToken: false,
                    persistSession: false,
                }),
            })
        );

        setIntervalSpy.mockRestore();
        processOnSpy.mockRestore();
    });

    it("initializes the RLS-bound client with the anon key", () => {
        setupModuleMocks();

        const anonClient = { auth: {}, from: jest.fn(), rpc: jest.fn() };
        mockCreateClient.mockReturnValue(anonClient);

        let exports: typeof import("../src/db/supabase");
        jest.isolateModules(() => {
            exports = require("../src/db/supabase");
        });

        expect(exports!.anonSupabase).toBe(anonClient);
        expect(exports!.default).toBe(anonClient);
        expect(mockCreateClient).toHaveBeenCalledWith(
            "http://localhost:54321",
            "test-anon-key",
            expect.objectContaining({
                auth: expect.objectContaining({
                    autoRefreshToken: false,
                    persistSession: false,
                }),
            })
        );
    });
});
