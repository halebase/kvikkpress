# Contributing

## Setup

```sh
rig up              # starts dev servers (site, start example, full example)
deno test src/      # unit tests
```

Type-check before submitting:

```sh
deno check examples/start/server.ts examples/start/build.ts
deno check examples/full/server.ts examples/full/build.ts
```

Read [AGENTS.md](AGENTS.md) for architecture and key patterns.

## Guidelines

**Bugfixes** — keep them scoped. One fix per PR, minimal diff, land fast.

**New features / larger changes** — modular code, clear separation of concerns. Avoid breaking the public API. If a breaking change is unavoidable, call it out explicitly in the PR.

**Documentation** — keep the README and AGENTS.md accurate. If your change affects usage, config, or public API, update the README. If it affects architecture or key patterns, update AGENTS.md. Both in the same PR.

## License

This project is [AGPL-3.0-only](LICENSE). Contributions are submitted under the same license.
