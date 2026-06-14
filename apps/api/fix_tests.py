import re
import os

with open('tests/reports.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all mockedSupabase.insert to use the global from instead
# Wait, actually, the easiest fix is to fix the global jest.mock definition
# to make `insert` and `update` correctly chainable!

new_mock = """
jest.mock("../src/db/client", () => {
    const chainable: any = jest.fn();
    chainable.mockReturnValue(chainable);
    
    chainable.from = chainable;
    chainable.select = chainable;
    chainable.insert = chainable;
    chainable.update = chainable;
    chainable.eq = chainable;
    chainable.gte = chainable;
    chainable.order = chainable;
    chainable.limit = chainable;
    
    // Default promises
    chainable.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chainable.then = jest.fn((cb) => cb({ data: null, error: null, count: 0 }));

    return { supabase: chainable };
});
"""

content = re.sub(
    r'jest\.mock\("\.\./src/db/client", \(\) => \(\{[\s\S]*?\}\)\);',
    new_mock.strip(),
    content
)

with open('tests/reports.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
