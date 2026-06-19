import subprocess, json
r = subprocess.run(
    ["docker","exec","-i","dtfm-postgres","sh","-c",
     "cat | psql -U dtfm_user -d dtfm_db"],
    input="SELECT current_user, current_database();\n",
    capture_output=True, text=True)
print("stdout:", r.stdout[:200])
print("stderr:", r.stderr[:200])
