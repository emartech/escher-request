# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@emartech/escher-request` is a TypeScript/JavaScript library that wraps HTTP requests with Escher authentication. It builds on axios for HTTP operations and escher-auth for request signing.

## Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Build the project (compiles TypeScript to dist/)
npm run build

# Run both lint and test
npm run verify

# Release (CI only)
npm run release
```

## Architecture

### Core Components

The library has three primary classes that work together:

1. **EscherRequest** (`src/request.ts`) - Main entry point
   - Factory method: `EscherRequest.create(accessKeyId, apiSecret, requestOptions)`
   - Provides HTTP methods: `get()`, `post()`, `put()`, `patch()`, `delete()`
   - Handles Escher signing via escher-auth library
   - Signs requests with EMS-specific constants (algoPrefix, vendorKey, etc.)
   - Optionally manages HTTP/HTTPS keep-alive agents

2. **EscherRequestOption** (`src/requestOption.ts`) - Configuration object
   - Configures host, port, headers, timeouts, SSL settings
   - Supports retry configuration via `axios-retry` (IAxiosRetryConfig)
   - Factory methods: `createForInternalApi()`, `createForServiceApi()`
   - Default timeout: 15000ms, default maxContentLength: 10MB
   - Always sets content-type to application/json by default

3. **RequestWrapper** (`src/wrapper.ts`) - HTTP execution layer
   - Wraps axios to execute signed requests
   - Handles response transformation and error handling
   - Supports retry logic through axios-retry when configured
   - Parses JSON responses automatically
   - Throws `EscherRequestError` on failures with status codes and data

4. **EscherRequestError** (`src/requestError.ts`) - Custom error type
   - Extends Error with `code`, `originalCode`, and `data` properties
   - Used for all HTTP and request-related failures

### Request Flow

1. User calls HTTP method on EscherRequest (e.g., `request.get('/path')`)
2. EscherRequest builds request options and signs them using escher-auth
3. RequestWrapper executes the request via axios with signed headers
4. Response is transformed and parsed (JSON if content-type matches)
5. Result is returned as `TransformedResponse<T>` with body, statusCode, statusMessage, headers

### Testing

- Uses Mocha as test runner with ts-node for TypeScript support
- Test files are co-located with source files (*.spec.ts)
- Uses Chai for assertions, Sinon for mocking, nock for HTTP mocking
- Tests run recursively in src/ directory

### TypeScript Configuration

- Source: `src/`, output: `dist/`
- Target: ES2020, module: CommonJS
- Strict mode enabled
- Main entry: `dist/request.js`, types: `dist/request.d.ts`
- Excludes spec files from compilation

### Linting

- Uses ESLint v10 with flat config (eslint.config.mjs)
- TypeScript ESLint integration
- Plugins: chai-friendly, no-only-tests, security
- Notable rule overrides: `@typescript-eslint/no-explicit-any: off`

### Release Process

- Uses semantic-release for automated versioning and publishing
- Commits must follow conventional commit format (semantic-release default)
- Examples: `feat:`, `fix:`, `chore:`, `docs:`, `BREAKING CHANGE:`
- PRs require approval from @js-maintainers before merge
- CI runs verify (lint + test) before release

### Node Version

- Requires Node.js >= 20

## Proxy Support

The library supports HTTP/HTTPS proxies through proxy agents:

- Uses `proxy-from-env` library to handle proxy environment variable lookup
- Automatically reads `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (and lowercase variants) environment variables
- `NO_PROXY` allows bypassing proxy for specific hosts (supports exact matches and domain suffixes)
- Can be explicitly configured via `proxy` option in `EscherRequestOption`
- Uses `http-proxy-agent` v5 and `https-proxy-agent` v5 (CommonJS-compatible versions)
- Proxy agents are created in the `EscherRequest` constructor based on:
  - Explicit `proxy` option (takes precedence over environment variables)
  - `getProxyForUrl()` from `proxy-from-env` (respects NO_PROXY)
  - Connection type (`secure` flag determines protocol in target URL)
- Target URL construction for NO_PROXY matching:
  - Omits default ports (443 for HTTPS, 80 for HTTP) from URL for cleaner matching
  - Includes non-standard ports in URL string (e.g., `https://host:8443`)
  - This ensures NO_PROXY rules work correctly for both standard and non-standard ports
- Works seamlessly with `keepAlive` option - both can be enabled together
