<div align="center">
  <h1>
    <img alt="Logwiz logo" src="src/lib/assets/logo.png" width="40" align="center">
    Logwiz
  </h1>
  <p>Open-source, self-hosted log management platform that allows you to run search directly on cloud storage.</p>

[![SvelteKit](https://img.shields.io/badge/SvelteKit-%23f1413d.svg?logo=svelte&logoColor=white)](#)
[![Release](https://img.shields.io/github/v/release/oleksandr-zhyhalo/logwiz)](https://github.com/oleksandr-zhyhalo/logwiz/releases)
[![License](https://img.shields.io/github/license/oleksandr-zhyhalo/logwiz)](LICENSE)

</div>

<div align="center">
  <picture>
    <img alt="Logwiz Screenshot" src="static/home-image.png" width="80%">
  </picture>
</div>

- **Search on object storage** — query logs stored directly on S3 and compatible object storage with Quickwit-powered full-text search
- **Readable investigation workflow** — use severity-aware log views, structured fields, quick filters, and histograms to move through incidents faster
- **Open ingest and export paths** — send logs over OTLP HTTP, use the NDJSON gateway for custom schemas, or ingest from sources like SQS, Kafka, or Pulsar
- **Self-hosted team access** — run Logwiz on your own infrastructure with invite-based access control and Google Authentication

## Status

Logwiz is under active development and has not yet reached a stable 1.0 release. Every release may introduce breaking changes in APIs, configuration, storage schema, or runtime behavior. Pin to an exact version, read the [CHANGELOG](CHANGELOG.md) before upgrading, and expect to revisit your setup between releases.

## Quick Start

```bash
curl -O https://raw.githubusercontent.com/oleksandr-zhyhalo/logwiz/main/docs-site/files/docker-compose.yml
docker compose up -d
```

For full installation options, see [docs.logwiz.io/install/docker-compose](https://docs.logwiz.io/install/docker-compose).

## Repository Layout

- `./` - the main Logwiz application
- `site/` - the marketing site
- `docs-site/` - the documentation site built with Mintlify

## License

[Apache License 2.0](LICENSE)
