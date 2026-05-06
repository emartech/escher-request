# @emartech/escher-request

## Usage

### Javascript

```javascript
const { EscherRequest, EscherRequestOption } = require('@emartech/escher-request');

const options = new EscherRequestOption('example.host.com', {
  credentialScope: 'eu/service/ems_request'
});
const request = EscherRequest.create('escher.key', 'escher.secret', options);

const heroId = 1;
const hero = await request.get(`/heroes/${heroId}`);
console.log(hero);

const heroes = await request.post('/heroes', {
  name: 'Captain America',
  sex: 'male'
});
console.log(heroes);
```

### Typescript

```typescript
import { EscherRequest, EscherRequestOption } from '@emartech/escher-request';

const options = new EscherRequestOption('example.host.com', {
  credentialScope: 'eu/service/ems_request'
});
const request = EscherRequest.create('escher.key', 'escher.secret', options);

const heroId = 1;
const hero = await request.get<{ name: string; }>(`/heroes/${heroId}`);
console.log(hero);

const heroes = await request.post<{ name: string; }[]>('/heroes', {
  name: 'Captain America',
  sex: 'male'
});
console.log(heroes);
```

### Retry

You can specify an optional retry config in the constructor of the EscherRequestOption's second parameter:
```typescript
const options = new EscherRequestOption('example.host.com', {
  credentialScope: 'eu/service/ems_request',
  retryConfig: {
      retries: 5
  }
});
```
The type of the `retryConfig` property is `IAxiosRetryConfig`, you can find the detailed list of available parameters here: https://github.com/softonic/axios-retry#options

### Proxy Support

The library supports HTTP/HTTPS proxies in three ways:

#### 1. Environment Variables (Automatic)

The library automatically detects and uses standard proxy environment variables:

```bash
export HTTPS_PROXY=http://proxy.example.com:8080
export HTTP_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,.local,internal.example.com
```

Lowercase variants (`https_proxy`, `http_proxy`, `no_proxy`) are also supported.

The `NO_PROXY` environment variable allows you to specify hosts that should bypass the proxy. It supports:
- Exact host matches: `localhost`
- Domain suffixes: `.local`, `.internal.example.com`
- Comma-separated lists: `localhost,.local,internal.example.com`

Proxy detection uses the [`proxy-from-env`](https://www.npmjs.com/package/proxy-from-env) library, which follows standard proxy environment variable conventions.

#### 2. Explicit Configuration

You can specify a proxy URL directly in the options:

```typescript
const options = new EscherRequestOption('example.host.com', {
  credentialScope: 'eu/service/ems_request',
  proxy: 'http://proxy.example.com:8080'
});
const request = EscherRequest.create('escher.key', 'escher.secret', options);
```

Explicit proxy configuration takes precedence over environment variables.

#### 3. Combined with Keep-Alive

Proxy support works seamlessly with the `keepAlive` option:

```typescript
const options = new EscherRequestOption('example.host.com', {
  credentialScope: 'eu/service/ems_request',
  proxy: 'http://proxy.example.com:8080',
  keepAlive: true
});
```

