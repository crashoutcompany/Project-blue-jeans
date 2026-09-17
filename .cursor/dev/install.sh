#!/usr/bin/env bash
# One-time, idempotent Cloud Agent install for Blue Jeans.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_DIR="$REPO_ROOT/.cursor/dev"
CERT_DIR="$DEV_DIR/certs"
DB_NAME="${DB_NAME:-bluejeans}"
DB_USER="${DB_USER:-blue}"
DB_PASS="${DB_PASS:-blue}"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m[cloud-agent]\033[0m %s\n' "$*"; }

db_url() {
  printf 'postgresql://%s:%s@db.localtest.me:5432/%s?sslmode=disable' \
    "$DB_USER" "$DB_PASS" "$DB_NAME"
}

echo "==> Hosts, Postgres, certificates, .env"
for h in db.localtest.me api.localtest.me apiauth.localtest.me; do
  grep -qE "^127\.0\.0\.1[[:space:]]+$h(\$|[[:space:]])" /etc/hosts || \
    echo "127.0.0.1 $h" | sudo tee -a /etc/hosts >/dev/null
done

if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get -o Acquire::Check-Valid-Until=false -o Acquire::Check-Date=false update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get \
    -o Acquire::Check-Valid-Until=false -o Acquire::Check-Date=false \
    install -y -qq postgresql postgresql-contrib
fi
PG_VERSION="$(ls /etc/postgresql 2>/dev/null | sort -n | tail -1)"
HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
sudo sed -i -E 's#^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32[[:space:]]+).*#\1password#' "$HBA"
sudo sed -i -E 's#^(host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128[[:space:]]+).*#\1password#' "$HBA"
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done
sudo pg_ctlcluster "$PG_VERSION" main reload 2>/dev/null || true

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' SUPERUSER;
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

if [ ! -f "$CERT_DIR/ca.crt" ] || [ ! -f "$CERT_DIR/server.crt" ]; then
  mkdir -p "$CERT_DIR"
  (
    cd "$CERT_DIR"
    openssl genrsa -out ca.key 2048 2>/dev/null
    openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
      -subj "/CN=Local Dev CA" -out ca.crt 2>/dev/null
    openssl genrsa -out server.key 2048 2>/dev/null
    openssl req -new -key server.key -subj "/CN=db.localtest.me" -out server.csr 2>/dev/null
    cat > server.ext <<'EXT'
subjectAltName = DNS:db.localtest.me, DNS:api.localtest.me, DNS:apiauth.localtest.me, DNS:localhost, IP:127.0.0.1
EXT
    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
      -out server.crt -days 3650 -sha256 -extfile server.ext 2>/dev/null
  )
fi

URL="$(db_url)"
if [ ! -f "$REPO_ROOT/.env" ]; then
  cat >"$REPO_ROOT/.env" <<EOF
DATABASE_URL="${URL}"
BETTER_AUTH_SECRET="local-dev-secret-not-for-production-0123456789abcdef"
TEST_AUTH_SECRET="local-test-auth-secret-not-for-production"
AUTH_GOOGLE_ID="dev-google-id"
AUTH_GOOGLE_SECRET="dev-google-secret"
EOF
else
  grep -q '^TEST_AUTH_SECRET=' "$REPO_ROOT/.env" || \
    printf '\nTEST_AUTH_SECRET="local-test-auth-secret-not-for-production"\n' >>"$REPO_ROOT/.env"
  grep -q '^BETTER_AUTH_SECRET=' "$REPO_ROOT/.env" || \
    printf '\nBETTER_AUTH_SECRET="local-dev-secret-not-for-production-0123456789abcdef"\n' >>"$REPO_ROOT/.env"
fi

echo "==> Installing dependencies"
pnpm install --frozen-lockfile
( cd "$DEV_DIR" && pnpm install )
pnpm exec playwright install --with-deps chromium

echo "==> Applying schema"
export PGPASSWORD="$DB_PASS"
psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/db/schema.sql"

echo "==> Environment install complete."
