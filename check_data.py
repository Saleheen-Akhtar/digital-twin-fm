import subprocess, json, os

# Login and save token
r = subprocess.run(
    ["curl","-s","http://localhost:4000/auth/login",
     "-X","POST",
     "-H","Content-Type: application/json",
     "-d",'{"email":"admin@dtfm.local","password":"changeme123"}'],
    capture_output=True, text=True)
token = json.loads(r.stdout)["accessToken"]

# Save to file so we don't embed it
with open("/tmp/token.txt","w") as f:
    f.write(token)

# Now use it with shell scripting
os.environ["TOK"] = token

# Get alerts
ep = "http://localhost:4000/alerts"
r2 = subprocess.run(
    f'curl -s "{ep}" -H "Authorization: Bearer {token}"',
    capture_output=True, text=True, shell=True)
alerts = json.loads(r2.stdout)
print(f"Alerts total: {len(alerts)}")
for a in alerts:
    sid = a.get("sensorId","?")
    print(f"  id={a['id'][:12]} sensor={sid[:20]:20s} sev={a['severity']:8s} status={a['status']:12s} msg={a['message'][:60]}")

# Get assets
r3 = subprocess.run(
    f'curl -s "http://localhost:4000/assets" -H "Authorization: Bearer {token}"',
    capture_output=True, text=True, shell=True)
assets = json.loads(r3.stdout)
online = sum(1 for a in assets if a.get("status") == "ok")
print(f"\nAssets: {len(assets)} total, {online} online")
statuses = {}
for a in assets:
    s = a.get("status","unknown")
    statuses[s] = statuses.get(s, 0) + 1
print(f"  Statuses: {statuses}")
