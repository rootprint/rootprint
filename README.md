<h1 align="center">Rootprint</h1>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white" alt="Bun"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Hono-%23E36002.svg?logo=hono&logoColor=white" alt="Hono"/></a>
  <a href="#"><img src="https://img.shields.io/badge/SvelteKit-%23FF3E00.svg?logo=svelte&logoColor=white" alt="SvelteKit"/></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-%234169E1.svg?logo=postgresql&logoColor=white" alt="PostgreSQL"/></a>
  <a href="https://github.com/rootprint/rootprint/releases"><img src="https://img.shields.io/github/v/release/rootprint/rootprint" alt="Release"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/rootprint/rootprint" alt="License"/></a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/126511?utm_source=trendshift-badge&utm_medium=badge&utm_campaign=badge-trendshift-126511" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/126511/monthly?language=Svelte" alt="rootprint%2Frootprint | Trendshift" width="250" height="55"/></a>
</p>

<h3 align="center">
  <a href="https://demo.rootprint.io">Live demo</a> &nbsp;·&nbsp;
  <a href="#quick-start">Quick start</a> &nbsp;·&nbsp;
  <a href="https://docs.rootprint.io">Docs</a> &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md">Contributing</a> &nbsp;·&nbsp;
  <a href="CHANGELOG.md">Changelog</a>
</h3>

Open-source, self-hosted logs and traces with full-text search directly on S3-compatible object storage.

Rootprint is open-source log and trace search that runs on your own object storage. Built on
Quickwit, it indexes every word of every log, so you can paste an error message and find every
line that contains it, across all your services. Indexes live in your S3, GCS, R2, MinIO or Azure
Blob bucket, so a year of retention costs a year of storage. Send logs and traces over
OpenTelemetry, follow a request from a log line to its trace, and see which services are slow or
failing.

> [!TIP]
> **Try it now at [demo.rootprint.io](https://demo.rootprint.io)** - live OpenTelemetry logs and
> traces from a running demo cluster.

[![Rootprint Logs page](.github/assets/logs.webp)](https://demo.rootprint.io)

## What You Get

- **Find any line** - Every word of every log is indexed, so you can search without knowing the
  service, stream or label. Save views, share links, and export to NDJSON, CSV or text.
- **Your bucket is the database** - Indexes live in your S3, GCS, R2, MinIO or Azure Blob bucket,
  and the whole stack is three containers: Rootprint, Quickwit and Postgres.
- **Logs and traces, one place** - Open a trace from any log, and the logs behind any span.
- **OpenTelemetry ingestion** - OTLP from any collector or SDK, plus NDJSON, Kafka, Kinesis and SQS.
- **AI agent access** - A read-only [MCP server](https://docs.rootprint.io/api/mcp) lets Claude
  Code, Cursor and other agents search your logs and traces.
- **Team access** - Roles, scoped API keys, and sign-in with Google, GitHub or OpenID Connect.
- **Admin controls** - Manage indexes, sources, field configuration and activity.
- **Apache-2.0** licensed.

## Traces

Search spans across every trace by service, operation, duration and status, and chart their volume,
error rate and latency. Open any trace as a waterfall, and jump from a span to the logs it produced.

[![The Rootprint trace explorer](.github/assets/traces.webp)](https://demo.rootprint.io)

Learn more: [Trace explorer](https://docs.rootprint.io/traces/search) ·
[Read a trace](https://docs.rootprint.io/traces/explore)

## Services

Request rate, error rate and p95 latency for every service, built from the spans you already send.
Open a service to see its operations, dependencies and errors.

[![The Rootprint Services catalog](.github/assets/services.webp)](https://demo.rootprint.io)

Learn more: [Service health](https://docs.rootprint.io/traces/services)

## Quick Start

Try it in one container, with Postgres and Quickwit inside:

```bash
docker run -p 8282:8282 -v rootprint:/data ghcr.io/rootprint/rootprint-aio
```

Opening it at another address than `localhost:8282`? Add `-e ORIGIN=http://<host>:<port>`, or
sign-in fails. Add `-d --restart unless-stopped` to keep it running in the background.

For a real install, run the three services with Docker Compose:

```bash
curl -o docker-compose.yml https://docs.rootprint.io/files/docker-compose.full.yaml
docker compose up -d
```

Open http://localhost:8282, then:

1. Create the first admin account.
2. Open **Send data** and follow the guide for your source. Its first step creates your ingest key.
3. Search your logs in **Logs** and your spans in **Traces**.

Full install guide: https://docs.rootprint.io/install/docker-compose

## Documentation

- [Quickstart](https://docs.rootprint.io/quickstart)
- [Send logs](https://docs.rootprint.io/send-logs/overview)
- [Send traces](https://docs.rootprint.io/traces/send)
- [Query syntax](https://docs.rootprint.io/search/query-language)
- [Configuration](https://docs.rootprint.io/configuration/environment-variables)
- [API reference](https://docs.rootprint.io/api/overview)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the repository layout and the checks to run
before opening a pull request.

## Status

Rootprint is under active development and has not reached 1.0. See [CHANGELOG.md](CHANGELOG.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
