# Phase 16 Report: Release Control Validation

## Scope

Phase 16 adds a repository-level release control check and documents the production release sequence.

## Implemented

- Added `pnpm check:release-controls`.
- The check verifies required release scripts are present.
- The check verifies the deploy workflow still runs readiness, smoke, security-header, and backup gates.
- Added `docs/release-management.md`.
- Added unit coverage that fails if required release controls are removed.

## Purpose

The app is deployed but not yet used broadly. This phase makes accidental weakening of the release process visible in tests before real users start depending on the system.
