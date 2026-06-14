const fs = require("fs");
let code = fs.readFileSync("tests/reports.test.ts", "utf8");

// The generic chainable mock that handles promises and count
const newMock = `
jest.mock("../src/db/client", () => {
    const createChainable = () => {
        const chainable = jest.fn();
        chainable.from = jest.fn(() => chainable);
        chainable.select = jest.fn(() => chainable);
        chainable.insert = jest.fn(() => chainable);
        chainable.update = jest.fn(() => chainable);
        chainable.eq = jest.fn(() => chainable);
        chainable.gte = jest.fn(() => chainable);
        chainable.order = jest.fn(() => chainable);
        chainable.limit = jest.fn(() => chainable);
        chainable.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chainable.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        chainable.then = jest.fn((cb) => cb({ data: null, count: 0, error: null }));
        return chainable;
    };
    return { supabase: createChainable() };
});`;

code = code.replace(/jest\.mock\("\.\.\/src\/db\/client"[\s\S]*?\}\)\);/, newMock.trim());

// For POST 201 test
code = code.replace(
    /mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?id: "report-id-123"[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);/g,
    `
            mockedSupabase.insert.mockReturnValueOnce({
                select: () => ({
                    single: () => Promise.resolve({
                        data: {
                            id: "report-id-123",
                            ...payload,
                            report_location: "POINT(77.5946 12.9716)",
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null
                    })
                })
            });
`
);

// For POST POINT test
code = code.replace(
    /mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?id: "report-id-456"[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);/g,
    `
            mockedSupabase.insert.mockReturnValueOnce({
                select: () => ({
                    single: () => Promise.resolve({
                        data: {
                            id: "report-id-456",
                            ...payload,
                            report_location: "POINT(72.8777 19.0760)",
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null
                    })
                })
            });
`
);

// For POST warning test
code = code.replace(
    /mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?id: "report-id-flag"[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);/g,
    `
            mockedSupabase.insert.mockReturnValueOnce({
                select: () => ({
                    single: () => Promise.resolve({
                        data: {
                            id: "report-id-flag",
                            ...payload,
                            report_location: "POINT(77.5946 12.9716)",
                            created_at: "2026-06-03T23:31:00Z",
                        },
                        error: null
                    })
                })
            });
`
);

// For POST is_escalated test
code = code.replace(
    /mockedSupabase\.insert = jest\.fn\(\)\.mockImplementation\(\(vals\) => \{[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \};\n            \}\);/g,
    `
            mockedSupabase.insert.mockImplementationOnce((vals) => {
                insertedPayload = vals;
                return {
                    select: () => ({
                        single: () => Promise.resolve({
                            data: {
                                id: "report-id-dup",
                                ...vals,
                                created_at: "2026-06-03T23:31:00Z",
                            },
                            error: null
                        })
                    })
                };
            });
`
);

// For PATCH tests overriding update
code = code.replace(
    /mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: updatedReport,[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);/g,
    `
            const fakeEq = () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: updatedReport, error: null }),
                    eq: fakeEq
                }),
                eq: fakeEq,
                then: (cb) => cb({ data: null, count: 0, error: null })
            });
            mockedSupabase.update.mockReturnValueOnce({ eq: fakeEq });
`
);

code = code.replace(
    /mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: null,[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);/g,
    `
            const fakeEq404 = () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: null, error: null }),
                    eq: fakeEq404
                }),
                eq: fakeEq404,
                then: (cb) => cb({ data: null, count: 0, error: null })
            });
            mockedSupabase.update.mockReturnValueOnce({ eq: fakeEq404 });
`
);

code = code.replace(
    /mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?status: "verified_fake", is_escalated: false \},[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);/g,
    `
            const fakeEqEscalated = () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: { ...mockReport, status: "verified_fake", is_escalated: false }, error: null }),
                    eq: fakeEqEscalated
                }),
                eq: fakeEqEscalated,
                then: (cb) => cb({ data: null, count: 0, error: null })
            });
            mockedSupabase.update.mockReturnValueOnce({ eq: fakeEqEscalated });
`
);

code = code.replace(
    /mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?status: validStatus \},[\s\S]*?\}\),\n                        \}\),\n                    \}\),\n                \}\);/g,
    `
                const fakeEqStatus = () => ({
                    select: () => ({
                        single: () => Promise.resolve({ data: { ...mockReport, status: validStatus }, error: null }),
                        eq: fakeEqStatus
                    }),
                    eq: fakeEqStatus,
                    then: (cb) => cb({ data: null, count: 0, error: null })
                });
                mockedSupabase.update.mockReturnValueOnce({ eq: fakeEqStatus });
`
);

// For PATCH overrides of select
code = code.replace(
    /mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \{ id: "report-id-123" \},[\s\S]*?\}\),\n                \}\),\n            \}\);/g,
    `
            const fakeSelectEq = () => ({
                single: () => Promise.resolve({ data: { id: "report-id-123" }, error: null })
            });
            mockedSupabase.select.mockReturnValueOnce({ eq: fakeSelectEq });
`
);

fs.writeFileSync("tests/reports.test.ts", code);
console.log("done");
