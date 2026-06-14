import re

with open('tests/reports.test.ts.bak', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the global mock to support order, limit, eq, select, single
global_mock = """jest.mock("../src/db/client", () => {
    const chainable = jest.fn() as any;
    chainable.from = jest.fn(() => chainable);
    chainable.select = jest.fn(() => chainable);
    chainable.insert = jest.fn(() => chainable);
    chainable.update = jest.fn(() => chainable);
    chainable.eq = jest.fn(() => chainable);
    chainable.gte = jest.fn(() => chainable);
    chainable.order = jest.fn(() => chainable);
    chainable.limit = jest.fn(() => chainable);
    chainable.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chainable.then = jest.fn((cb) => cb({ data: null, count: 0, error: null }));
    return { supabase: chainable };
});"""

code = re.sub(r'jest\.mock\("\.\./src/db/client", \(\) => \(\{.*?\}\)\);', global_mock, code, flags=re.DOTALL)

def replacer(match):
    # If the mock defines an error, grab it
    error_match = re.search(r'error:\s*([^,}]+)', match.group(0))
    error_str = error_match.group(1).strip() if error_match else 'null'
    
    # If the mock defines data, grab it
    data_match = re.search(r'data:\s*(\{.*?\}|\[.*?\]|null|updatedReport)', match.group(0), re.DOTALL)
    data_str = data_match.group(1).strip() if data_match else 'null'
    
    # Check if the data has { ...mockReport } which needs to be left as is without quotes
    
    # If this is for update, select, insert
    func_match = re.match(r'\s*mockedSupabase\.(\w+)', match.group(0))
    func_name = func_match.group(1) if func_match else 'select'
    
    return f"""
            mockedSupabase.{func_name}.mockImplementationOnce(() => {{
                const chainable = jest.fn() as any;
                chainable.select = jest.fn(() => chainable);
                chainable.eq = jest.fn(() => chainable);
                chainable.order = jest.fn(() => chainable);
                chainable.single = jest.fn().mockResolvedValueOnce({{ data: {data_str}, error: {error_str} }});
                chainable.then = jest.fn((cb) => cb({{ data: {data_str}, count: 0, error: {error_str} }}));
                return chainable;
            }});
    """

# Handle the complex insert block with function
complex_insert = """
            mockedSupabase.insert.mockImplementationOnce((vals) => {
                insertedPayload = vals;
                const chainable = jest.fn() as any;
                chainable.select = jest.fn(() => chainable);
                chainable.eq = jest.fn(() => chainable);
                chainable.single = jest.fn().mockResolvedValueOnce({
                    data: {
                        id: "report-id-dup",
                        ...vals,
                        created_at: "2026-06-03T23:31:00Z",
                    },
                    error: null
                });
                return chainable;
            });
"""
code = re.sub(r'mockedSupabase\.insert = jest\.fn\(\)\.mockImplementation\(\(vals\) => \{.*?return \{.*?\};\n\s*\}\);', complex_insert, code, flags=re.DOTALL)

# Handle the simple mockReturnValues
code = re.sub(r'\s*mockedSupabase\.(?:select|insert|update) = jest\.fn\(\)\.mockReturnValue\(\{.*?\}\);', replacer, code, flags=re.DOTALL)

# And clearAllMocks shouldn't clear mock returns, but let's make sure beforeEach is clean
code = code.replace("jest.clearAllMocks();", "jest.clearAllMocks();")

with open('tests/reports.test.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print('done')
