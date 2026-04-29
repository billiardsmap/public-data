# BILLIARDSMAP NATIONAL DATA REGISTRY - SOURCE OF TRUTH

> [!CAUTION]
> **PUBLIC REPOSITORY WARNING**
> This repository (`billiardsmap-public-data`) is **100% PUBLIC**.
> Do **NOT** commit any internal roadmaps, monetization models, pricing JSONs, agent prompts, or private business strategies here. All internal docs must be saved to the workspace root (`/roadmap`, `/docs`, `/reports`). Reference `/docs/SECURITY-PROTOCOLS.md` at the workspace root for full boundaries.

This document controls the entire data ingestion and moderation system.

## 1. What is Truth
- **GitHub is Truth:** The `billiardsmap-public-data` repository is the singular authoritative source of truth for all pool rooms, tournaments, and directors.
- **Workers are Logic:** Cloudflare Workers (`api.billiardsmap.com`) read from GitHub, enrich, validate, and serve data, but they NEVER permanently store original data state.
- **Frontend is Presentation:** The Astro/React apps consume from the Workers. The frontend does not have its own database for these entities.

## 2. Who Can Change Truth
- **Automated Workers:** via Pull Requests ONLY. No direct automated pushes to `main`.
- **Verified Owners:** Claims approved by moderation are committed to the repo via an automated PR.
- **Core Maintainers:** Can directly merge PRs or commit manual overrides.

## 3. Verification & Ownership Proof
- For a room to be marked `verified`, it must be cross-referenced across two of: Google Maps, official website, APA/BCA registry, or direct manual contact.
- Ownership proof requires verification via a callback to the venue’s listed public phone number, or matching domain email verification.

## 4. Moderation Rules
- User submissions flow into the `submissions/pending-review.json` queue.
- Submissions are reviewed. Once approved, the worker automatically generates a commit to move the record into the appropriate `rooms/states/{state}.json` or `tournaments/` index.

## 5. Source Trust Hierarchy
1. **Verified Owner/Director Input** (Highest Trust)
2. **Official Room Website / Facebook**
3. **APA / BCA League Directories**
4. **Google Maps / Yelp verified listings**
5. **Crowdsourced Submissions** (Lowest Trust - Requires manual verification before going live)

## 6. Rollback Policy
- Data regressions or malicious claims are immediately reverted using `git revert` on the specific PR. No manual database surgery is required.

## 7. Fraud Prevention
- Cloudflare Workers perform deduplication using Levenshtein distance on business names and geocoding proximity.
- Any submission triggering a high-similarity match to an existing room is flagged as a duplicate and placed in the moderation queue rather than auto-published.
