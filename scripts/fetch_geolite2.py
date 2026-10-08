"""
Script to download GeoLite2-ASN and GeoLite2-Country databases using a MaxMind License key.
Intended to be run in CI / GitHub Actions or locally by developers, NEVER on the live request path.
"""

import os
import tarfile
import urllib.request
import tempfile
import shutil

ACCOUNT_ID = os.getenv("MAXMIND_ACCOUNT_ID")
LICENSE_KEY = os.getenv("MAXMIND_LICENSE_KEY")
TARGET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "geolite2")

EDITIONS = ["GeoLite2-ASN", "GeoLite2-Country"]

def download_and_extract(edition: str):
    if not LICENSE_KEY:
        print("[!] MAXMIND_LICENSE_KEY is not set. Skipping download.")
        return

    url = f"https://download.maxmind.com/app/geoip_download?edition_id={edition}&license_key={LICENSE_KEY}&suffix=tar.gz"
    print(f"[*] Downloading {edition}...")

    os.makedirs(TARGET_DIR, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tar_path = os.path.join(tmp_dir, f"{edition}.tar.gz")
        urllib.request.urlretrieve(url, tar_path)

        with tarfile.open(tar_path, "r:gz") as tar:
            for member in tar.getmembers():
                if member.name.endswith(".mmdb"):
                    member.name = os.path.basename(member.name)
                    tar.extract(member, TARGET_DIR)
                    print(f"[+] Extracted {member.name} to {TARGET_DIR}")

if __name__ == "__main__":
    for ed in EDITIONS:
        download_and_extract(ed)
