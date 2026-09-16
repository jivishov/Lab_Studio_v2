# Lab Studio domain-scoped MCP adapter

This server is request-scoped and tools-first. It has no database, draft store, assignment API, student identity fields, purchasing action, arbitrary URL fetcher, resources/prompts dependency, or widget requirement. The Streamable HTTP endpoint is `POST /mcp`; newline-delimited stdio is available with `--stdio`.

Exactly five chemistry compatibility tools are registered in Cycle 05. Every tool calls the same `ChemistryDomainPack` services used by direct TypeScript callers.

Cycle 12 registers a second `assaystudio` domain through the same adapter, JSON-RPC handler,
transport, limits, idempotency cache, redacted observability, and error mapping:

- `assaystudio.search_capabilities`
- `assaystudio.assess_protocol`
- `assaystudio.compose_assay`
- `assaystudio.validate_assay`
- `assaystudio.plan_run`
- `assaystudio.ingest_observations`

The six assay tools are stateless and call the same pure release services as the direct app.
Composition is limited to source-controlled 96-well templates plus caller-authored descriptive
metadata. Observation ingestion returns an uncommitted review candidate. No tool fetches arbitrary
URLs, accepts images automatically, stores drafts or student data, performs clinical interpretation,
or executes purchasing or hardware actions.

Runtime configuration:

- `LAB_STUDIO_MCP_PORT` selects the HTTP port (default `8787`).
- `LAB_STUDIO_MCP_ALLOWED_ORIGINS` is a comma-separated exact allowlist. Server-to-server clients without an `Origin` header and localhost origins are accepted by default.

Outputs never include local paths, hashes, vendor file handles, provider responses, credentials, hidden reasoning, runtime state, or student data. Planning returns incomplete diagnostics when reviewed quantities are absent and never performs purchases or external writes.
