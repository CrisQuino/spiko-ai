import subprocess, json, sys

# Reads the Vercel token and app env vars from .env.local (gitignored).
# The token is NO LONGER hardcoded here — keep it in .env.local only.

def load_env(path=".env.local"):
    env = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env

env_vars = load_env()

TOKEN = env_vars.get("VERCEL_TOKEN")
if not TOKEN:
    print("ERROR: VERCEL_TOKEN not found in .env.local")
    sys.exit(1)

TEAM_ID = env_vars.get("VERCEL_TEAM_ID", "")
project_id = env_vars.get("VERCEL_PROJECT_ID")

# Resolve project id if not provided
if not project_id:
    result = subprocess.run([
        "curl", "-s", "-H", f"Authorization: Bearer {TOKEN}",
        "https://api.vercel.com/v9/projects?search=spiko"
    ], capture_output=True, text=True)
    data = json.loads(result.stdout)
    projects = data.get("projects", [])
    if not projects:
        print("No projects found")
        sys.exit(1)
    project_id = projects[0]["id"]
    print(f"Resolved project id: {project_id}")

team_qs = f"?teamId={TEAM_ID}" if TEAM_ID else ""

# App variables to push to Vercel (secrets/config, NOT the deploy tokens)
required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
    "RESEND_API_KEY",
    "ANTHROPIC_API_KEY",
]

for key in required:
    if key not in env_vars:
        print(f"Skipping {key} - not found in .env.local")
        continue

    value = env_vars[key]
    is_sensitive = key not in ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL"]

    payload = {
        "key": key,
        "value": value,
        "type": "encrypted" if is_sensitive else "plain",
        "target": ["production", "preview", "development"],
    }

    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "-H", f"Authorization: Bearer {TOKEN}",
        "-H", "Content-Type: application/json",
        f"https://api.vercel.com/v10/projects/{project_id}/env{team_qs}",
        "-d", json.dumps(payload)
    ], capture_output=True, text=True)

    resp = json.loads(result.stdout)
    if "error" in resp:
        print(f"Error setting {key}: {resp['error']['message']}")
    else:
        print(f"Set {key}: OK")

print("\nDone! Now redeploy from Vercel dashboard.")
