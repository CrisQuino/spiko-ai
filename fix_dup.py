import re

with open('src/app/demo/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the end of addAIMessage function
pattern = r'  const addAIMessage.*?^  };'
m = re.search(pattern, text, re.DOTALL | re.MULTILINE)
if m:
    pos = m.end()
    # Find the start of the real useBrowserTTS function
    end = text.find('const useBrowserTTS', pos)
    # Find the last closing brace before it
    end = text.rfind('  };', pos, end) + 4
    
    # Build clean replacement
    replacement = '\n\n  // Browser TTS fallback function (for mobile/iOS compatibility)\n'
    new_text = text[:pos] + replacement + text[end:]
    
    with open('src/app/demo/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Fixed!')
else:
    print('Pattern not found')
