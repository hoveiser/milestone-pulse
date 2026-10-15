"""Create the public GitHub repo, push main + tag, publish gh-pages, enable Pages.

The token is only ever passed through a git credential helper that reads it from
the process environment, so it never appears in any command string, log, or the
committed tree. Only safe output is printed.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
TOKEN = os.environ["GITHUB_TOKEN"]
USER = "hoveiser"
REPO = "milestone-pulse"
API = "https://api.github.com"
LIVE = f"https://{USER}.github.io/{REPO}/"
REMOTE = f"https://github.com/{USER}/{REPO}.git"
AUTHOR = ["-c", "user.name=MilestonePulse", "-c", "user.email=dev@milestonepulse.local"]
CRED_HELPER = '!f(){ echo username=personal_access_token; echo "password=$GITHUB_TOKEN"; }; f'
GIT_ENV = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}


def sh(args, check=True, capture=False, cwd=None, env=None):
    return subprocess.run(args, check=check, text=True, capture_output=capture, cwd=cwd, env=env or GIT_ENV)


def push(branch):
    sh(["git", "-c", "credential.helper=", "-c", f"credential.helper={CRED_HELPER}",
        "push", "--force", "origin", branch], cwd=str(ROOT))


def api(method, path, body=None):
    data = None
    headers = {"Authorization": f"Bearer {TOKEN}", "User-Agent": "milestone-pulse",
               "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def ensure_repo():
    code, body = api("POST", "/user/repos", {"name": REPO, "private": False,
                     "description": "MilestonePulse GenLayer ship-date accountability prediction market"})
    if code == 201:
        print("repo created")
    elif code == 422 and "already exists" in body:
        print("repo already exists")
    else:
        print("repo create:", code, body[:160])


def publish_main():
    has_head = sh(["git", "rev-parse", "--verify", "HEAD"], check=False, capture=True).returncode == 0
    if has_head:
        branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture=True).stdout.strip()
        if branch != "main":
            sh(["git", "branch", "-M", "main"])
    else:
        # Unborn repo: point HEAD at refs/heads/main before the first commit.
        sh(["git", "symbolic-ref", "HEAD", "refs/heads/main"])
    sh(["git", "add", "-A"])
    if sh(["git", "diff", "--cached", "--quiet"], check=False).returncode != 0:
        sh(["git"] + AUTHOR + ["commit", "-m", "feat: MilestonePulse contract, terminal, tests, docs and on-chain evidence"])
    sh(["git", "remote", "remove", "origin"], check=False)
    sh(["git", "remote", "add", "origin", REMOTE])
    sh(["git"] + AUTHOR + ["tag", "-f", "-m", "studionet deployment v1", "studionet-v1"])
    push("main")
    push("studionet-v1")
    print("pushed main + tag")


def publish_gh_pages():
    dist = ROOT / "frontend" / "dist"
    if not (dist / "index.html").exists():
        print("ERROR: frontend/dist not built")
        sys.exit(1)
    tmp = Path(tempfile.mkdtemp(prefix="mp-ghpages-"))
    try:
        for item in dist.iterdir():
            dest = tmp / item.name
            shutil.copytree(item, dest) if item.is_dir() else shutil.copy2(item, dest)
        sh(["git", "init", "-b", "gh-pages"], cwd=str(tmp))
        sh(["git", "add", "-A"], cwd=str(tmp))
        sh(["git"] + AUTHOR + ["commit", "-m", "chore: publish GitHub Pages build"], cwd=str(tmp))
        sh(["git", "remote", "add", "origin", REMOTE], cwd=str(tmp))
        sh(["git", "-c", "credential.helper=", "-c", f"credential.helper={CRED_HELPER}",
            "push", "--force", "origin", "gh-pages"], cwd=str(tmp))
        print("pushed gh-pages")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def enable_pages():
    code, body = api("POST", f"/repos/{USER}/{REPO}/pages", {"source": {"branch": "gh-pages", "path": "/"}})
    if code == 201:
        print("pages enabled")
    elif code == 409:
        code, body = api("PUT", f"/repos/{USER}/{REPO}/pages", {"source": {"branch": "gh-pages", "path": "/"}})
        print("pages updated:", code)
    else:
        print("pages enable:", code, body[:160])


def verify_live():
    deadline = time.time() + 180
    last = None
    while time.time() < deadline:
        try:
            req = urllib.request.Request(LIVE, headers={"User-Agent": "mp"})
            with urllib.request.urlopen(req, timeout=20) as r:
                last = r.status
                if r.status == 200:
                    print("LIVE 200 OK:", LIVE)
                    return True
        except urllib.error.HTTPError as e:
            last = e.code
        except Exception as e:
            last = str(e)[:80]
        time.sleep(10)
    print("live check ended:", last, LIVE)
    return False


if __name__ == "__main__":
    ensure_repo()
    publish_main()
    publish_gh_pages()
    enable_pages()
    verify_live()
