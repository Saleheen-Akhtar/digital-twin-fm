import re
with open(r'C:\Users\sahil\Projects\Digital-Twinn\.env', 'r') as f:
    content = f.read()
content = re.sub(r'^POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=testpass', content, flags=re.MULTILINE)
with open(r'C:\Users\sahil\Projects\Digital-Twinn\.env', 'w') as f:
    f.write(content)
print('Updated POSTGRES_PASSWORD to testpass')
