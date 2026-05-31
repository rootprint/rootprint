# Vendored Protobuf Sources

These `.proto` files are vendored from upstream so that `bun run proto:gen` is offline-buildable. See `docs/superpowers/specs/2026-05-12-ingest-design.md` §2.2 for the rationale.

## Version pins

| Source                                       | Tag / Commit                               | Notes                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opentelemetry-proto`                        | `v1.5.0`                                   | https://github.com/open-telemetry/opentelemetry-proto/releases/tag/v1.5.0                                                                                              |
| `googleapis`                                 | `a0cedfb6af9305b49db07dccaa7d0c8985e07e70` | googleapis has no release tags; pinned to `master` as of vendoring.                                                                                                    |
| `protocolbuffers/protobuf` (for `any.proto`) | `v25.3`                                    | No longer vendored — resolved from @bufbuild/protobuf/wkt by codegen. Kept in the table for historical reference; remove this row in a future refresh if no one cares. |

## Refresh recipe

When OTEL or googleapis evolves and you need newer schemas:

```bash
PROTO_ROOT=apps/api/proto

OTEL_BASE=https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/<TAG>/opentelemetry/proto
curl -sf -o $PROTO_ROOT/opentelemetry/proto/collector/logs/v1/logs_service.proto $OTEL_BASE/collector/logs/v1/logs_service.proto
curl -sf -o $PROTO_ROOT/opentelemetry/proto/logs/v1/logs.proto                  $OTEL_BASE/logs/v1/logs.proto
curl -sf -o $PROTO_ROOT/opentelemetry/proto/common/v1/common.proto              $OTEL_BASE/common/v1/common.proto
curl -sf -o $PROTO_ROOT/opentelemetry/proto/resource/v1/resource.proto          $OTEL_BASE/resource/v1/resource.proto

GOOG_BASE=https://raw.githubusercontent.com/googleapis/googleapis/<SHA>/google/rpc
curl -sf -o $PROTO_ROOT/google/rpc/status.proto $GOOG_BASE/status.proto
curl -sf -o $PROTO_ROOT/google/rpc/code.proto   $GOOG_BASE/code.proto
```

After refreshing, update the table above with the new pins and run `bun run proto:gen`. Review the diff in `apps/api/src/gen/` to confirm only intended changes.

## Modifying

Do NOT edit these `.proto` files locally. They are upstream sources. Local edits will be overwritten on refresh.
