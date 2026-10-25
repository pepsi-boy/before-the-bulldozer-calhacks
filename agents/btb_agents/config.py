"""Settings for the Before the Bulldozer agents. Override any of these with env vars."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Where the Next.js app is running (local dev or the OCI deployment).
APP_URL = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")
# Must match AGENT_API_KEY in the app's .env.local if you set one there.
AGENT_API_KEY = os.getenv("AGENT_API_KEY", "")

# How often the Permit Watcher asks the app to sync from Apify.
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "300"))
# Cap how many new permits get scanned per sync so a big backlog doesn't flood the scout.
MAX_NEW_PER_SYNC = int(os.getenv("MAX_NEW_PER_SYNC", "3"))

# Photos for a permit go in PHOTOS_DIR/<permit id>/*.jpg|png (e.g. uploaded by a site visitor).
PHOTOS_DIR = Path(os.getenv("PHOTOS_DIR", str(REPO_ROOT / "agents" / "photos")))
# Demo mode: when a permit has no photos yet, scan the public-domain demo house instead.
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
DEMO_PHOTOS_DIR = REPO_ROOT / "public" / "demo"

NONPROFITS_PATH = REPO_ROOT / "data" / "nonprofits.json"

# Seeds give each agent a stable address. Change SEED_PREFIX before deploying.
SEED_PREFIX = os.getenv("SEED_PREFIX", "before-the-bulldozer-calhacks-change-me")

BUREAU_PORT = int(os.getenv("BUREAU_PORT", "8100"))
CONCIERGE_PORT = int(os.getenv("CONCIERGE_PORT", "8101"))


def seed(name: str) -> str:
    return f"{SEED_PREFIX}-{name}"


def app_headers() -> dict[str, str]:
    return {"x-agent-key": AGENT_API_KEY} if AGENT_API_KEY else {}
