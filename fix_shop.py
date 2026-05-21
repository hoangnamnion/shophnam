import re

# Read the current messy shop.html
raw = open('shop.html', encoding='utf-8').read()

# Extract only the body HTML between <body> and </body>
body_match = re.search(r'<body>(.*?)</body>', raw, re.DOTALL)
body_content = body_match.group(1).strip() if body_match else ''

# Build clean HTML
clean = '''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MKShop - Nang Gold Locket</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="shop.css">
</head>
<body>
''' + body_content + '''
<script src="shop.js" defer></script>
</body>
</html>
'''

open('shop.html', 'w', encoding='utf-8').write(clean)
print(f'Done. Lines: {clean.count(chr(10))}')
print('Has shop.css link:', '<link rel="stylesheet" href="shop.css">' in clean)
print('Has shop.js script:', 'src="shop.js"' in clean)
print('Has inline style:', '<style>' in clean)
print('Has inline script block:', '<script>' in clean)
