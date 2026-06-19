import subprocess, json
r = subprocess.run(
    ["c:/Users/sahil/bin/infisical.exe", "export", "--env=dev", "--format=json"],
    capture_output=True, text=True)
secrets = json.loads(r.stdout)
for s in secrets:
    k = s["key"]
    if k in ("REDIS_PASSWORD", "REDIS_PORT"):
        print(f"{k}: {s['value']}")
