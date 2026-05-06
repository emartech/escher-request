import { IAxiosRetryConfig } from 'axios-retry';

const MEGA_BYTE = 1024 * 1024;

export interface RequestOptions {
  secure?: boolean;
  port?: number;
  host?: string;
  rejectUnauthorized?: boolean;
  headers?: string[][];
  prefix?: string;
  timeout?: number;
  allowEmptyResponse?: boolean;
  maxContentLength?: number;
  keepAlive?: boolean;
  credentialScope?: string;
  retryConfig?: IAxiosRetryConfig | null;
  proxy?: string;
}

export class EscherRequestOption implements RequestOptions {
  secure = true;
  port = 443;
  host = '';
  rejectUnauthorized = true;
  headers: string[][] = [];
  prefix = '';
  timeout = 15000;
  allowEmptyResponse = false;
  maxContentLength = 10 * MEGA_BYTE;
  keepAlive = false;
  credentialScope = '';
  retryConfig: IAxiosRetryConfig | null = null;
  proxy?: string;

  public static createForInternalApi(host: string | RequestOptions, rejectUnauthorized: boolean) {
    return this.create(host, '/api/v2/internal', rejectUnauthorized);
  }

  public static createForServiceApi(host: string | RequestOptions, rejectUnauthorized: boolean) {
    return this.create(host, '/api/services', rejectUnauthorized);
  }

  public static create(host: string | RequestOptions, prefix = '', rejectUnauthorized = true) {
    let options: RequestOptions = {};

    if (typeof host === 'object') {
      options = host;
      host = options.host || '';
    } else {
      options.rejectUnauthorized = rejectUnauthorized;
    }

    options.prefix = prefix;
    return new EscherRequestOption(host, options);
  }

  constructor(host: string, options: RequestOptions) {
    this.secure = options.secure !== false;
    this.port = options.port || 443;
    this.host = host;
    this.rejectUnauthorized = options.rejectUnauthorized !== false;
    this.prefix = '';
    this.timeout = options.timeout || 15000;
    this.allowEmptyResponse = false;
    this.maxContentLength = options.maxContentLength || 10 * MEGA_BYTE;
    this.keepAlive = !!options.keepAlive;
    this.retryConfig = options.retryConfig || null;

    Object.assign(this, options || {});

    this.setHeader(['content-type', 'application/json']);
    this.setHeader(['host', host]);
  }

  public setToSecure(port: number, rejectUnauthorized: boolean) {
    this.port = port || 443;
    this.secure = true;
    this.rejectUnauthorized = rejectUnauthorized;
  }

  public setToUnsecure(port: number) {
    this.port = port || 80;
    this.secure = false;
  }

  public setHost(host: string) {
    this.host = host;
  }

  public setPort(port: number) {
    this.port = port;
  }

  public setHeader(headerToSet: string[]) {
    this.headers = this.headers
      .filter(existingHeader => existingHeader[0] !== headerToSet[0])
      .concat([headerToSet]);
  }

  public getHeader(name: string) {
    const result = this.headers.find((header) => {
      return header[0].toLowerCase() === name.toLowerCase();
    });

    return result ? result[1] : null;
  }

  public setTimeout(timeout: number) {
    this.timeout = timeout;
  }

  public getTimeout() {
    return this.timeout;
  }

  public toHash(): RequestOptions {
    const hash: RequestOptions = {
      port: this.port,
      host: this.host,
      headers: this.headers.slice(0),
      prefix: this.prefix,
      timeout: this.timeout,
      maxContentLength: this.maxContentLength,
      retryConfig: this.retryConfig
    };

    if (!this.rejectUnauthorized) {
      hash.rejectUnauthorized = false;
    }

    if (this.allowEmptyResponse) {
      hash.allowEmptyResponse = true;
    }

    return hash;
  }
}
