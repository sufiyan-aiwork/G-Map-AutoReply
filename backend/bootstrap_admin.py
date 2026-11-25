"""
Secure CLI Script to Bootstrap or Update an Initial Administrator Account.
Prompts interactively for username and password without echoing or logging secrets.
Also supports generating a password hash only (--hash-only) for env-based setup.

Usage:
    cd backend
    python bootstrap_admin.py
    python bootstrap_admin.py --hash-only
"""

import argparse
import asyncio
import getpass
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.integrations.supabase_client import db
from app.services.admin_auth_service import AdminAuthService


async def main():
    parser = argparse.ArgumentParser(description="Bootstrap Techzone Review Automation Admin User")
    parser.add_argument("--username", type=str, help="Administrator username")
    parser.add_argument("--full-name", type=str, default="Techzone Administrator", help="Administrator full name")
    parser.add_argument("--hash-only", action="store_true", help="Output scrypt hash only without database write")
    args = parser.parse_args()

    if args.hash_only:
        pw1 = getpass.getpass("Enter password to hash: ")
        pw2 = getpass.getpass("Confirm password: ")
        if pw1 != pw2 or len(pw1) < 8:
            print("Error: Passwords must match and be at least 8 characters.", file=sys.stderr)
            sys.exit(1)
        print(AdminAuthService.hash_password(pw1))
        return

    username = (args.username or input("Admin username: ")).strip().lower()
    if not username:
        print("Error: Username cannot be empty.", file=sys.stderr)
        sys.exit(1)

    pw1 = getpass.getpass("Admin password (min 8 chars): ")
    pw2 = getpass.getpass("Confirm admin password: ")
    if pw1 != pw2:
        print("Error: Passwords do not match.", file=sys.stderr)
        sys.exit(1)
    if len(pw1) < 8:
        print("Error: Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    pw_hash = AdminAuthService.hash_password(pw1)
    existing = await db.get_admin_by_username(username)
    if existing:
        updated = await db.update_admin_password(existing["id"], pw_hash, full_name=args.full_name)
        print(f"Updated credentials for existing administrator '{updated['username']}'.")
    else:
        created = await db.create_admin_user(
            username=username,
            password_hash=pw_hash,
            full_name=args.full_name,
            is_active=True,
        )
        print(f"Created administrator account '{created['username']}' successfully.")


if __name__ == "__main__":
    asyncio.run(main())
