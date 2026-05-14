---
title: Send logs documentation design
date: 2026-04-16
status: approved
---

# Send logs documentation design

## Goal

Add a reader-friendly `Send Logs` section that explains how Logwiz receives logs through its authenticated HTTP gateway, starting from the built-in OpenTelemetry path and linking out to the low-level API reference.

## Why this change

The current docs have pieces of this story split across `quickstart.mdx`, `api/overview.mdx`, and `api/ingest-logs.mdx`, but there is no single landing page for admins who want to understand how to send logs into Logwiz.

The current site also has two content gaps:

- API reference pages exist but are not exposed in `docs.json` navigation.
- Some internal links point to missing administration pages.

## Approved direction

### Information architecture

- Add a new top-level docs section named `Send Logs`.
- Keep the main guide as a single page for this pass.
- Keep `api/overview.mdx` and `api/ingest-logs.mdx` as reference pages instead of turning them into the main guide.
- Expose the API reference in the sidebar so guide pages can link to visible contract documentation.

### Page placement

- New guide page path: `send-logs/index.mdx`
- Sidebar section label: `Send Logs`
- Existing product UI references should continue to use `Administration -> Send Logs` inside the content.

## Page design

The new page should be task-oriented and move from the default setup to the broader ingestion model.

### 1. Send logs with Logwiz

Open with a short explanation that Logwiz sits in front of Quickwit as an authenticated ingestion gateway.

### 2. Start with the built-in OpenTelemetry index

Explain that the default project setup already includes the standard `otel-logs-v0_9` path, so users can start sending logs without first designing a custom index flow.

### 3. How Logwiz reads OTel fields

Document the defaults Logwiz applies for OTel indexes whose IDs start with `otel-logs-`:

- level field: `severity_text`
- message field: `body`
- traceback field: `attributes.exception.stacktrace`

Also explain that field paths support dot notation and point readers to per-index configuration for overrides and extra context fields.

### 4. Send logs over HTTP

Explain the ingestion workflow:

- Create a token in `Administration -> Send Logs`
- Send requests to `/api/ingest/{indexId}`
- Logwiz validates the bearer token
- Logwiz enforces the token's index allowlist
- Logwiz forwards the request body to Quickwit

The examples should use NDJSON because that is the main logging example already used in the docs, but the guide wording should describe the gateway generically because the backend preserves the inbound request body and `Content-Type` instead of enforcing a Logwiz-specific payload format.

### 5. Reference links

End with links to:

- `quickstart.mdx`
- `configuration/index-config.mdx`
- `api/overview.mdx`
- `api/ingest-logs.mdx`

## Supporting doc changes

This design includes a small cleanup pass around the new page:

- Update `docs.json` to add the `Send Logs` section.
- Update `docs.json` to expose the existing API reference pages.
- Update `quickstart.mdx` to link to the new `Send Logs` page.
- Update `api/overview.mdx` so it links to the new guide instead of the missing `/administration/ingest-tokens` page.
- Tighten `api/ingest-logs.mdx` wording so it stays reference-focused and does not duplicate the guide.

## Out of scope

- App UI changes in the `Administration -> Send Logs` screen
- Backend ingest behavior changes
- Creating the missing user management or ingest token administration docs beyond what is needed for link cleanup in this pass
- Splitting `Send Logs` into multiple subpages during this pass

## Risks and constraints

- The docs currently frame ingestion as NDJSON-only in places, while the backend forwards the request more generically. The new guide should remove that ambiguity without over-promising unsupported Quickwit formats.
- The `mint` CLI is not installed in the current environment, so Mintlify validation may require either installing the CLI or using an existing project script if one is later added.

## Success criteria

- Readers can discover a `Send Logs` section directly from the sidebar.
- The new page explains the default OTel path first, then the broader HTTP forwarding model.
- The page explains the OTel field defaults and where to override them.
- The guide and API reference pages no longer send readers to missing admin docs for this flow.
- The docs remain consistent with the current product behavior and naming.
