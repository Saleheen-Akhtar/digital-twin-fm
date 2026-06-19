import re

with open(r"C:\Users\sahil\Projects\Digital-Twinn\.env", "r") as f:
    content = f.read()

# Update both passwords
content = re.sub(r"^POSTGRES_PASSWORD=.*", "POSTGRES_PASSWORD=testpass", content, flags=re.MULTILINE)
content = re.sub(r"^REDIS_PASSWORD=.*", "REDIS_PASSWORD=dtfm_redis_2024", content, flags=re.MULTILINE)
content = re.sub(r"^POSTGRES_URL=.*", "POSTGRES_URL=postgresql://dtfm_user:testpass@localhost:5432/dtfm_db", content, flags=re.MULTILINE)
content = re.sub(r"^REDIS_URL=.*", "REDIS_URL=redis://default:dtfm_redis_2024@localhost:6379/0", content, flags=re.MULTILINE)

with open(r"C:\Users\sahil\Projects\Digital-Twinn\.env", "w") as f:
    f.write(content)

print("Updated .env with working passwords")

# Update Infisical too? No - just local dev fix.
