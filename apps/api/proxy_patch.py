import re

with open('tests/reports.test.ts.bak', 'r', encoding='utf-8') as f:
    code = f.read()

proxy_mock = """jest.mock("../src/db/client", () => {
    const createProxy = (data = null, error = null, count = 0) => {
        const handler = {
            get: (target, prop) => {
                if (prop === 'then') {
                    return (resolve) => resolve({ data: target.mockData, error: target.mockError, count: target.mockCount });
                }
                if (prop === 'single') {
                    return jest.fn().mockResolvedValue({ data: target.mockData, error: target.mockError });
                }
                if (prop === 'mockData' || prop === 'mockError' || prop === 'mockCount') {
                    return target[prop];
                }
                if (['from', 'select', 'insert', 'update', 'eq', 'order', 'limit', 'gte'].includes(prop)) {
                    return jest.fn(() => new Proxy(target, handler));
                }
                return target[prop];
            }
        };
        const target = jest.fn() as any;
        target.mockData = data;
        target.mockError = error;
        target.mockCount = count;
        return new Proxy(target, handler);
    };
    return { supabase: createProxy(), createProxy };
});"""

code = re.sub(r'jest\.mock\("\.\./src/db/client", \(\) => \(\{.*?\}\)\);', proxy_mock, code, flags=re.DOTALL)

def replacer(match):
    # Extract data from the matched mock string
    data_match = re.search(r'data:\s*(\{.*?\}|\[.*?\]|null|updatedReport)', match.group(0), re.DOTALL)
    data_str = data_match.group(1).strip() if data_match else 'null'
    
    # Extract the function name being mocked
    func_match = re.match(r'\s*mockedSupabase\.(\w+)', match.group(0))
    func_name = func_match.group(1) if func_match else 'select'
    
    return f"""            mockedSupabase.{func_name}.mockImplementationOnce(() => require("../src/db/client").createProxy({data_str}));"""

complex_insert = """            mockedSupabase.insert.mockImplementationOnce((vals) => {
                insertedPayload = vals;
                return require("../src/db/client").createProxy({
                    id: "report-id-dup",
                    ...vals,
                    created_at: "2026-06-03T23:31:00Z",
                });
            });"""

code = re.sub(r'mockedSupabase\.insert = jest\.fn\(\)\.mockImplementation\(\(vals\) => \{.*?return \{.*?\};\n\s*\}\);', complex_insert, code, flags=re.DOTALL)

code = re.sub(r'\s*mockedSupabase\.(?:select|insert|update) = jest\.fn\(\)\.mockReturnValue\(\{.*?\}\);', replacer, code, flags=re.DOTALL)

# Add "let updatedReport;" to fix reference errors, or just let it be if it's already there.

with open('tests/reports.test.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print('done')
