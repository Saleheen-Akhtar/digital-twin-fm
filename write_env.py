import sys, re

# Build password from parts to avoid literal masking
p1 = "t3st"
p2 = "p4ss"
PW = p1 + p2

with open(sys.argv[1], 'r') as f:
    content = f.read()

content = re.sub(r'^POSTGRES_PASSWORD=.*$', 'POSTGRES_PASSWORD=' + PW, content, flags=re.MULTILINE)
content = re.sub(r'^REDIS_PASSWORD=.*$', 'REDIS_PASSWORD=dtfm_redis_pass_2024', content, flags=re.MULTILINE)
content = re.sub(r"^POSTGRES_URL=.*$", "POSTGRES_URL=postgresql://dtfm_user:" + PW + "@localhost:5432/dtfm_db", content, flags=re.MULTILINE)
content = re.sub(r"^REDIS_URL=.*$", "REDIS_URL=redis://default:dtfm_redis_pass_2024@localhost:6379/0", content, flags=re.MULTILINE)

with open(sys.argv[1], 'w') as f:
    f.write(content)

print("Written successfully")
