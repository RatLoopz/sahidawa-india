import re

with open('tests/reports.test.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace all mockedSupabase.select = jest.fn().mockReturnValue({ eq: ... }) 
# with a chainable mock that handles multiple eq calls and returns the correct data.

def replacer_select(match):
    content = match.group(0)
    
    # Extract the data object if present
    data_match = re.search(r'data:\s*(\{.*?\})', content, re.DOTALL)
    data_str = data_match.group(1) if data_match else "null"
    
    return f"""
            const fakeEqSelect = jest.fn() as any;
            fakeEqSelect.mockReturnValue({{
                single: jest.fn().mockResolvedValue({{ data: {data_str}, error: null }}),
                eq: fakeEqSelect,
                select: fakeEqSelect
            }});
            mockedSupabase.select = jest.fn().mockReturnValue({{
                eq: fakeEqSelect,
                single: jest.fn().mockResolvedValue({{ data: {data_str}, error: null }})
            }});
    """

code = re.sub(r'mockedSupabase\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?\}\);', replacer_select, code)

with open('tests/reports.test.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print('done')
