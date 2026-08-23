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

To install, sign, and strictly verify an immutable artifact in one step:

```yaml
- uses: Jmainguy/notation-action@v1
  with:
    version: 1.3.2
    artifact: zot.soh.re/jmainguy/example@sha256:...
    key-name: jon-soh-re
    private-key: ${{ secrets.NOTATION_PRIVATE_KEY }}
    certificate-chain: ${{ secrets.NOTATION_CERTIFICATE_CHAIN }}
    ca-certificate: ${{ secrets.NOTATION_CA_CERTIFICATE }}
    username: ${{ secrets.HELM_USERNAME }}
    password: ${{ secrets.HELM_PASSWORD }}
```

Signing configuration and key material are written only beneath the runner's temporary directory and removed after verification.
