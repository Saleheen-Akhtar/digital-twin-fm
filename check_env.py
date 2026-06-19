import re

with open(r"C:\Users\sahil\Projects\Digital-Twinn\.env", "r") as f:
    content = f.read()

# Check current values
for line in content.splitlines():
    for key in ("POSTGRES_PASSWORD", "REDIS_PASSWORD", "POSTGRES_URL", "REDIS_URL"):
        if line.startswith(f"{key}="):
            print(line[:60])
