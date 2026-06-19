import subprocess, json

# Login
r = subprocess.run(
    ["curl","-s","http://localhost:4000/auth/login",
     "-X","POST","-H","Content-Type: application/json",
     "-d",'{"email":"admin@dtfm.local","password":"changeme123"}'],
    capture_output=True, text=True)
token = json.loads(r.stdout)["accessToken"]

# Test each endpoint
for ep in ["/buildings","/assets","/sensors","/alerts"]:
    r = subprocess.run(
        ["curl","-s",f"http://localhost:4000{ep}",
         "-H","Authorization: Bearer " + token],
        capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        if isinstance(data, list):
            print(f"GET {ep}: 200 — {len(data)} items")
            if len(data) > 0:
                print(f"  First: {json.dumps(data[0], indent=2)[:200]}")
        else:
            print(f"GET {ep}: {r.stdout[:150]}")
    except:
        print(f"GET {ep}: {r.stdout[:150]}")
