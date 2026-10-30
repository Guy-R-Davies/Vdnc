"""Keep static asset URLs tied to their contents so deployments bypass old caches."""
import argparse
import hashlib
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true", help="Check without changing index.html")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
index = root / "index.html"
original = index.read_text()
updated = original
for name in ("style.css", "math.js", "app.js"):
    version = hashlib.sha256((root / name).read_bytes()).hexdigest()[:12]
    pattern = rf'((?:src|href)="){re.escape(name)}(?:\?[^\"]*)?(\")'
    updated, count = re.subn(pattern, rf'\g<1>{name}?v={version}\2', updated)
    if count != 1:
        raise SystemExit(f"Expected exactly one reference to {name} in index.html")
if args.check:
    if updated != original:
        raise SystemExit("Stale asset versions: run python3 scripts/version_assets.py")
    print("Asset versions match file contents.")
else:
    if updated != original:
        index.write_text(updated)
    print("Asset URLs versioned by content.")
