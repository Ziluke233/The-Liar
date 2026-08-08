#!/usr/bin/env python3
"""Build self-contained release HTML from the dev source (index.html).

The dev source references external artwork under assets/ (e.g.
`assets/player1_gaming.svg`). This script inlines every `assets/...` reference
as a base64 data URI, producing a fully self-contained file that needs no
external files. It writes two outputs:

  - TheLiar_standalone.html   local standalone copy
  - deploy/index.html         GitHub Pages build output (used by CI deploy)

deploy/.nojekyll is left untouched. The generated files are git-ignored
(see .gitignore); the only source of truth is index.html.

Usage:  python3 build.py
"""
import base64
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "index.html")
OUT_STANDALONE = os.path.join(ROOT, "TheLiar_standalone.html")
OUT_DEPLOY = os.path.join(ROOT, "deploy", "index.html")

ASSET_RE = re.compile(r"assets/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+")

MIME = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
}


def main():
    with open(SRC, encoding="utf-8") as f:
        html = f.read()

    asset_paths = sorted(set(ASSET_RE.findall(html)))
    if not asset_paths:
        print("No asset references found; nothing to inline.")
    else:
        replacements = {}
        for rel in asset_paths:
            abs_path = os.path.join(ROOT, rel.replace("/", os.sep))
            if not os.path.isfile(abs_path):
                print(f"WARNING: asset not found, skipped: {rel}")
                continue
            with open(abs_path, "rb") as af:
                data = af.read()
            b64 = base64.b64encode(data).decode("ascii")
            ext = os.path.splitext(rel)[1].lower()
            mime = MIME.get(ext, "application/octet-stream")
            replacements[rel] = f"data:{mime};base64,{b64}"

        for rel, datauri in replacements.items():
            html = html.replace(rel, datauri)
        print(f"Inlined {len(replacements)} asset(s): {', '.join(replacements)}")

    os.makedirs(os.path.dirname(OUT_DEPLOY), exist_ok=True)
    with open(OUT_STANDALONE, "w", encoding="utf-8") as f:
        f.write(html)
    with open(OUT_DEPLOY, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {OUT_STANDALONE} ({len(html)} bytes)")
    print(f"Wrote {OUT_DEPLOY} ({len(html)} bytes)")


if __name__ == "__main__":
    main()
