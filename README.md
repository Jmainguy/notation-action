# notation-action

A small TypeScript GitHub Action that installs the official [Notation CLI](https://github.com/notaryproject/notation).

The action downloads the matching release archive and Notary Project checksum file, verifies SHA-256, caches the extracted CLI, and adds it to `PATH`.

```yaml
- uses: Jmainguy/notation-action@v1
  with:
    version: 1.3.2
- run: notation version
```

Set `version: latest` to resolve the current official release dynamically. Pin an explicit CLI version in release pipelines for reproducibility.
