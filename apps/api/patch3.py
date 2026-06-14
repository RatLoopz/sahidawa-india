import re

with open('tests/reports.test.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the global mock
global_mock = """jest.mock("../src/db/client", () => {
    const chainable = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        then: jest.fn((cb) => cb({ data: null, count: 0, error: null })),
    };
    return { supabase: chainable };
});"""

code = re.sub(r'jest\.mock\("\.\./src/db/client", \(\) => \(\{[\s\S]*?\}\)\);', global_mock, code)

# Replace all the complex mock structures with just setting single/then on mockedSupabase
# POST Route Test 1: returns 201
code = re.sub(
    r'mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({
                data: {
                    id: "report-id-123",
                    ...payload,
                    report_location: "POINT(77.5946 12.9716)",
                    created_at: "2026-06-03T23:31:00Z",
                },
                error: null
            });''',
    code,
    count=1
)

# POST Route Test 2: parses coordinates
code = re.sub(
    r'mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({
                data: {
                    id: "report-id-456",
                    ...payload,
                    report_location: "POINT(72.8777 19.0760)",
                    created_at: "2026-06-03T23:31:00Z",
                },
                error: null
            });''',
    code,
    count=1
)

# POST Route Test 3: returns warning
code = re.sub(
    r'mockedSupabase\.insert = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({
                data: {
                    id: "report-id-flag",
                    ...payload,
                    report_location: "POINT(77.5946 12.9716)",
                    created_at: "2026-06-03T23:31:00Z",
                },
                error: null
            });''',
    code,
    count=1
)

# POST Route Test 4: stores is_escalated
code = re.sub(
    r'mockedSupabase\.insert = jest\.fn\(\)\.mockImplementation\(\(vals\) => \{[\s\S]*?return \{[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \};\n            \}\);',
    r'''mockedSupabase.insert.mockImplementationOnce((vals) => {
                insertedPayload = vals;
                return mockedSupabase;
            });
            mockedSupabase.single.mockResolvedValueOnce({
                data: {
                    id: "report-id-dup",
                    ...payload,
                    created_at: "2026-06-03T23:31:00Z",
                },
                error: null
            });''',
    code
)

# GET Route Test 1: returns 200
code = re.sub(
    r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \[\n[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.then.mockImplementationOnce((cb) => cb({
                data: [
                    { id: "1", status: "pending", created_at: "2026-06-01T00:00:00Z" },
                    { id: "2", status: "verified_real", created_at: "2026-06-02T00:00:00Z" },
                ],
                error: null
            }));''',
    code
)

# GET Route Test 2: returns empty array
code = re.sub(
    r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \[\],[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.then.mockImplementationOnce((cb) => cb({
                data: [],
                error: null
            }));''',
    code
)

# PATCH Route Test 1: returns 404
code = re.sub(
    r'mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: null,[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({ data: null, error: null });''',
    code
)

# PATCH Route Test 2: returns 200
code = re.sub(
    r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \{ id: "report-id-123" \},[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);\n\n            mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: updatedReport,[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({ data: { id: "report-id-123" }, error: null });
            mockedSupabase.single.mockResolvedValueOnce({ data: updatedReport, error: null });''',
    code
)

# PATCH Route Test 3: sets is_escalated = false
code = re.sub(
    r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \{ id: "report-id-123" \},[\s\S]*?error: null,[\s\S]*?\}\),\n                \}\),\n            \}\);\n\n            mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?status: "verified_fake", is_escalated: false \},[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \}\),\n            \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({ data: { id: "report-id-123" }, error: null });
            mockedSupabase.single.mockResolvedValueOnce({ data: { ...mockReport, status: "verified_fake", is_escalated: false }, error: null });
            // And mock the district alert query
            mockedSupabase.then.mockImplementationOnce((cb) => cb({ data: null, count: 0, error: null }));
    ''',
    code
)

# PATCH Route Test 4: accepts all valid status values
code = re.sub(
    r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?data: \{ id: "report-id-123" \},[\s\S]*?error: null,[\s\S]*?\}\),\n                    \}\),\n                \}\);\n\n                mockedSupabase\.update = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?status: validStatus \},[\s\S]*?error: null,[\s\S]*?\}\),\n                        \}\),\n                    \}\),\n                \}\);',
    r'''mockedSupabase.single.mockResolvedValueOnce({ data: { id: "report-id-123" }, error: null });
                mockedSupabase.single.mockResolvedValueOnce({ data: { ...mockReport, status: validStatus }, error: null });
                mockedSupabase.then.mockImplementationOnce((cb) => cb({ data: null, count: 0, error: null }));
    ''',
    code
)


with open('tests/reports.test.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print('done')
