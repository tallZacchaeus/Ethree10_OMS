#!/usr/bin/env bash
#
# One command that runs every test suite against real infrastructure.
#
# Before this existed, the integration suite defaulted to a database URL naming
# one developer's macOS account on port 5432 while docker-compose publishes
# 5433 — so the documented way to start local infrastructure produced a database
# the tests did not look at. Combined with their absence from CI, the RBAC and
# governance suites ran nowhere at all. Anyone claiming the permission model was
# tested could not have been contradicted, because nobody could run the tests.
#
# Usage:  pnpm verify
#
# Override any of these to point at infrastructure you already have:
#   TEST_DATABASE_URL   default postgres@localhost:5433/ethree10_test
#   STORAGE_ENDPOINT    default http://127.0.0.1:9000
set -euo pipefail

cd "$(dirname "$0")/.."

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/ethree10_test?schema=public}"
STORAGE_ENDPOINT="${STORAGE_ENDPOINT:-http://127.0.0.1:9000}"
STORAGE_ACCESS_KEY="${STORAGE_ACCESS_KEY:-minioadmin}"
STORAGE_SECRET_KEY="${STORAGE_SECRET_KEY:-minioadmin}"
STORAGE_BUCKET="${STORAGE_BUCKET:-ethree10-test}"

export TEST_DATABASE_URL STORAGE_ENDPOINT STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_BUCKET
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DATABASE_URL"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# CI brings its own services; only start compose when running locally.
if [ "${CI:-}" != "true" ]; then
  step "Starting local infrastructure"
  docker compose up -d postgres minio

  step "Waiting for Postgres"
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      echo "postgres ready"; break
    fi
    sleep 1
  done

  step "Creating the test database if absent"
  # `|| true` because "already exists" is the expected case on every run but
  # the first, and is not a failure.
  docker compose exec -T postgres createdb -U postgres ethree10_test 2>/dev/null \
    && echo "created ethree10_test" || echo "ethree10_test already exists"
fi

step "Applying migrations to the test database"
pnpm prisma migrate deploy

step "Generating the Prisma client"
pnpm db:generate

step "Ensuring the storage bucket exists"
pnpm tsx scripts/ensure-bucket.ts

step "Unit tests"
pnpm test

step "Docs tests"
pnpm test:docs

step "Integration tests (real Postgres + MinIO)"
pnpm test:integration

printf '\n\033[1;32mAll suites passed.\033[0m\n'
