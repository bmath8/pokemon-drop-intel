# Pokémon Drop Intel

> **Live demo:** _(deploying — link coming)_ · A local-first Pokémon TCG collection & drop-intelligence cockpit.
> Built by Brian Mathew as an AI-assisted developer (Next.js 16 · React 19 · TypeScript · Tailwind 4).
> The dashboard runs entirely on bundled sample data — **no account, login, or credentials needed** to explore it.

---
A local-first Pokemon TCG drop intelligence cockpit for collectors who want faster awareness without checkout automation, queue bypassing, proxy rotation, CAPTCHA evasion, or retailer-rule evasion.

The app focuses on:

- Official and retailer watchlists
- Local store memory and session journaling
- Email, raw file, mailbox archive, and IMAP mailbox parsing
- Product normalization against a curated registry
- Browser notifications, webhook delivery, and product-specific alert thresholds
- Filtered mailbox sync for high-signal sender and subject matching
- Fair stock monitoring for curated launch links with manual checkout handoff

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ImapFlow for read-only IMAP sync

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

Use these before and after meaningful changes:

```bash
npm run lint
npm run build
npm audit
```

Current expected lint state: no errors, with existing `@next/next/no-img-element` warnings for remote product artwork.

## Mailbox Sync Configuration

Required environment variables:

```bash
POKEMON_MAILBOX_HOST=imap.example.com
POKEMON_MAILBOX_USER=collector@example.com
POKEMON_MAILBOX_PASSWORD=app-password
```

Optional environment variables:

```bash
POKEMON_MAILBOX_PORT=993
POKEMON_MAILBOX_SECURE=true
POKEMON_MAILBOX_PATH=INBOX
POKEMON_MAILBOX_LIMIT=20
POKEMON_MAILBOX_SCAN_LIMIT=80
POKEMON_MAILBOX_SINCE_HOURS=48
POKEMON_MAILBOX_SENDER_FILTERS=pokemoncenter.com,target,bestbuy
POKEMON_MAILBOX_SUBJECT_FILTERS=pokemon,tcg,early access,restock,preorder
```

Dashboard mailbox filters are stored locally in the browser and are merged with the optional environment filters for each sync.

## Fair Stock Monitor

The Drops view can check the curated product registry links while the app is open. It classifies pages as available, out, blocked, manual review, or error, then opens matching retailer pages for manual action only.

Safety limits:

- Checks are rate-limited by the server, defaulting to once per 60 seconds.
- The monitor only reads public curated launch links from the local product registry.
- Product selection lets you narrow checks to the active drop window without increasing request volume.
- Alerts are deduped by link and status so one noisy page does not keep firing.

Webhook delivery supports Discord, Slack, or custom JSON through the existing safe relay route.

It does not automate carting, checkout, queue behavior, CAPTCHA handling, proxies, account rotation, or purchase-limit evasion.

Optional environment variable:

```bash
POKEMON_STOCK_MIN_INTERVAL_SECONDS=60
```

## Webhook Relay

Webhook presets support custom JSON, Discord, Slack, and ntfy payload formats.

By default, webhook relay blocks localhost and private-network targets to reduce SSRF risk. For a trusted local-only lab setup, set:

```bash
POKEMON_ALLOW_PRIVATE_WEBHOOKS=true
```

Only do this when you understand the destination and are running the app on a trusted machine.

## Security Notes

- Webhook tokens are currently stored in browser local storage for single-user local operation.
- IMAP credentials are read only from server-side environment variables.
- Upload routes reject empty files and enforce size limits.
- Webhook relay requires valid absolute `http` or `https` URLs and blocks private destinations by default.
- The stock monitor is intentionally limited to public page checks and manual checkout links.
- The app is intentionally not a checkout bot and does not automate purchases.

## Known Follow-Ups

- Add automated unit tests for parser, normalizer, and API guard behavior.
- Replace raw `<img>` usage with a documented image strategy or configured `next/image` remote patterns.
- Add delivery profiles so different channels can use different thresholds and webhook destinations.
- Add source scoring from session outcomes once enough attempt history exists.
