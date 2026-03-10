# Logwiz

Open-source logging UI for [Quickwit](https://quickwit.io). Search, filter, and visualize your logs with a modern web interface.

## Features

- Full-text log search with Lucene query syntax
- Time range filtering with relative and absolute presets
- Quick filters with field value aggregations
- Log frequency histogram with severity distribution
- Configurable field mappings per index
- User authentication with email/password
- Shareable queries via URL parameters

## Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com) (for Quickwit)

## Getting Started

1. **Start Quickwit:**

   ```bash
   docker compose up -d
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `BETTER_AUTH_SECRET` to a random 32-character string.

4. **Push database schema:**

   ```bash
   bun run db:push
   ```

5. **Start the dev server:**

   ```bash
   bun run dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

## License

[GNU AGPL v3](LICENSE)
