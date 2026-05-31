<div align="center">
  <h1>
		<img alt="Rootprint logo" src="apps/web/src/lib/assets/logo.png" width="40" align="center">
    Rootprint
  </h1>
  <p>Open-source, self-hosted log management platform that allows you to run search directly on cloud storage.</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-%233178C6.svg?logo=typescript&logoColor=white)](#)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](#)
[![Hono](https://img.shields.io/badge/Hono-%23E36002.svg?logo=hono&logoColor=white)](#)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-%23FF3E00.svg?logo=svelte&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%234169E1.svg?logo=postgresql&logoColor=white)](#)
[![Release](https://img.shields.io/github/v/release/rootprint/rootprint)](https://github.com/rootprint/rootprint/releases)
[![License](https://img.shields.io/github/license/rootprint/rootprint)](LICENSE)

</div>

<div align="center">
  <picture>
    <img alt="Rootprint Screenshot" src="apps/web/static/home-image.png" width="80%">
  </picture>
</div>

- **Search on object storage** — query logs stored directly on S3 and compatible object storage with Quickwit-powered full-text search
- **Readable investigation workflow** — use severity-aware log views, structured fields, quick filters, and histograms to move through incidents faster
- **Open ingest and export paths** — send logs over OTLP HTTP, use the NDJSON gateway for custom schemas, or ingest from sources like SQS, Kafka, or Pulsar
- **Self-hosted team access** — run Rootprint on your own infrastructure with invite-based access control and Google Authentication

## Status

Rootprint is under active development and has not yet reached a stable 1.0 release. Every release may introduce breaking changes in APIs, configuration, storage schema, or runtime behavior. Pin to an exact version, read the [CHANGELOG](CHANGELOG.md) before upgrading, and expect to revisit your setup between releases.

## Quick Start

```bash
curl -o docker-compose.yml https://docs.rootprint.io/files/docker-compose.yaml
docker compose up -d
```

For full installation options, see [docs.rootprint.io/install/docker-compose](https://docs.rootprint.io/install/docker-compose).

## Repository Layout

Rootprint is organized as a Bun-workspace monorepo under `apps/`:

- `apps/api/` - Hono backend (logs ingest, search proxy, auth)
- `apps/web/` - SvelteKit log viewer UI

## License

[Apache License 2.0](LICENSE)
