import re

with open('src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the first useEffect closure and remove everything after it until the real loadDashboard
pattern = r'(  }, \[\];)(\n\n  const loadDashboard = async \(\) => \{.*?\n  \}, \[\];\n\n  const loadDashboard = async \(\) => \{\n)'
replacement = r'\1\n\n  const loadDashboard = async () => {'

text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open('src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed dashboard/page.tsx')
