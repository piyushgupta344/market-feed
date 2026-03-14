# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a security vulnerability, please open a [GitHub Security Advisory](https://github.com/piyushgupta344/market-feed/security/advisories/new) in this repository. This keeps the report private until a fix is released.

Include as much of the following as possible:

- Type of issue (e.g. prototype pollution, credential leak, dependency vulnerability)
- Full paths of affected source files
- Steps to reproduce or proof-of-concept
- Potential impact

You can expect an acknowledgement within **3 business days** and a resolution timeline within **14 days** of confirmation.

## Scope

market-feed is a client library that calls third-party financial data APIs. It does not:

- accept user-uploaded content
- store or transmit credentials beyond forwarding API keys to the configured providers
- run a server

The primary security surface is **dependency supply chain** and **API key handling**.

## Dependency security

- Dependencies are tracked with Dependabot (`dependabot.yml`)
- Production code has **zero runtime dependencies** — only `peerDependencies` (React) and optional duck-typed integrations
- The published npm package includes npm provenance attestation (`NPM_CONFIG_PROVENANCE=true`)

## API key handling

market-feed does not log, cache, or transmit API keys to any destination other than the configured provider endpoint. Keys are passed directly in HTTP headers or query parameters as required by each provider's documented API.
