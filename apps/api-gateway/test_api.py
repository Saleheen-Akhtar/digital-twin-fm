import subprocess, json

# Login
r = subprocess.run(
    ["curl","-s","http://localhost:4000/auth/login",
     "-X","POST",
     "-H","Content-Type: application/json",
     "-d",'{"email":"admin@dtfm.local","password":"changeme123"}'],
    capture_output=True, text=True)
token = json.loads(r.stdout)["accessToken"]
print(token[:20])

# Test endpoints
for ep in ["/buildings","/assets","/sensors","/alerts"]:
    cmd = ["curl","-s",f"http://localhost:4000{ep}",
           "-H","Authorization: Bearer " + token]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        if isinstance(data, list):
            print(f"GET {ep}: 200 - {len(data)} items")
            if data:
                print(f"  fields: {list(data[0].keys())}")
        else:
            print(f"GET {ep}: {r.stdout[:150]}")
    except Exception as e:
        print(f"GET {ep}: {r.stdout[:150]}")
