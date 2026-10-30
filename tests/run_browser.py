"""Run the browser checks against a running local preview (standard library only)."""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--browser", required=True, help="Chrome or Chromium executable")
parser.add_argument("--url", default="http://127.0.0.1:8765")
parser.add_argument("--screenshots", action="store_true")
args = parser.parse_args()
subprocess.run([sys.executable, str(Path(__file__).resolve().parent.parent / "scripts" / "version_assets.py"), "--check"], check=True)


def chrome(extra):
    with tempfile.TemporaryDirectory(prefix="vdnc-chrome-") as profile:
        result = subprocess.run([
            args.browser, "--headless", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", "--disable-background-timer-throttling",
            f"--user-data-dir={profile}", *extra,
        ], capture_output=True, text=True, timeout=50)
    if result.returncode:
        raise SystemExit(result.stderr[-3000:])
    return result.stdout


dom = chrome(["--virtual-time-budget=20000", "--dump-dom", args.url+"/tests/"])
Path("/tmp/vdnc-browser-checks.html").write_text(dom)
match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
print(match.group(1) if match else "Browser returned no test result", flush=True)
if 'data-result="passed"' not in dom:
    raise SystemExit(1)
if args.screenshots:
    # Desktop Chrome on macOS imposes a 500px minimum viewport. The suite
    # also checks a true 375px viewport through its iframe.
    for width, height, name in [(1440, 1050, "desktop"), (500, 1450, "mobile")]:
        output = f"/tmp/vdnc-{name}.png"
        chrome([f"--window-size={width},{height}", "--hide-scrollbars",
                "--virtual-time-budget=1500", f"--screenshot={output}", args.url+"/"])
        print(output, flush=True)
