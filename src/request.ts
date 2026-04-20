const Escher = require('escher-auth');
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyForUrl } from 'proxy-from-env';
import { EscherRequestOption } from './requestOption';
export { EscherRequestOption } from './requestOption';
import { RequestWrapper, ExtendedRequestOption, TransformedResponse } from './wrapper';
export { TransformedResponse } from './wrapper';
export { EscherRequestError } from './requestError';
import { createLogger } from '@emartech/json-logger';
const logger = createLogger('suiterequest');

export class EscherRequest {
  private static EscherConstants = {
    algoPrefix: 'EMS',
    vendorKey: 'EMS',
    credentialScope: 'eu/suite/ems_request',
    authHeaderName: 'X-Ems-Auth',
    dateHeaderName: 'X-Ems-Date'
  };
  private escher: any;
  private options: EscherRequestOption;
  public readonly httpAgent?: HttpAgent;
  public readonly httpsAgent?: HttpsAgent;

  public static create(accessKeyId: string, apiSecret: string, requestOptions: EscherRequestOption) {
    return new EscherRequest(accessKeyId, apiSecret, requestOptions);
  }

  constructor(accessKeyId: string, apiSecret: string, requestOptions: EscherRequestOption) {
    const escherConfig = Object.assign({}, EscherRequest.EscherConstants, {
      accessKeyId: accessKeyId,
      apiSecret: apiSecret,
      credentialScope: requestOptions.credentialScope || EscherRequest.EscherConstants.credentialScope
    });

    this.escher = new Escher(escherConfig);
    this.options = requestOptions;

    const proxyUrl = this.getProxyUrl(requestOptions);

    if (proxyUrl) {
      this.httpAgent = new HttpProxyAgent(proxyUrl, { keepAlive: requestOptions.keepAlive });
      this.httpsAgent = new HttpsProxyAgent(proxyUrl, { keepAlive: requestOptions.keepAlive });
    } else if (requestOptions.keepAlive) {
      this.httpAgent = new HttpAgent({ keepAlive: true });
      this.httpsAgent = new HttpsAgent({ keepAlive: true });
    }
  }

  private getProxyUrl(requestOptions: EscherRequestOption): string | undefined {
    if (requestOptions.proxy) {
      return requestOptions.proxy;
    }

    // Build the target URL to check against NO_PROXY
    const protocol = requestOptions.secure ? 'https:' : 'http:';
    const port = requestOptions.port;
    const defaultPort = requestOptions.secure ? 443 : 80;

    // Only include port in URL if it's non-standard
    const hostWithPort = port === defaultPort
      ? requestOptions.host
      : `${requestOptions.host}:${port}`;

    const targetUrl = `${protocol}//${hostWithPort}`;

    // Use proxy-from-env to respect NO_PROXY and other proxy env vars
    return getProxyForUrl(targetUrl);
  }

  public get<T = any>(path: string, data?: any): Promise<TransformedResponse<T>> {
    return this.request('GET', path, data);
  }

  public patch<T = any>(path: string, data: any): Promise<TransformedResponse<T>> {
    return this.request('PATCH', path, data);
  }

  public post<T = any>(path: string, data: any): Promise<TransformedResponse<T>> {
    return this.request('POST', path, data);
  }

  public put<T = any>(path: string, data: any): Promise<TransformedResponse<T>> {
    return this.request('PUT', path, data);
  }

  public delete<T = any>(path: string): Promise<TransformedResponse<T>> {
    return this.request('DELETE', path);
  }

  public setOptions(requestOptions: EscherRequestOption): void {
    this.options = requestOptions;
  }

  public getOptions(): EscherRequestOption {
    return this.options;
  }

  private request(method: string, path: string, data?: any) {
    const options = this.getOptionsFor(method, path);
    const payload = data ? this.getPayload(data) : '';
    const signedOptions = this.signRequest(options, payload);

    logger.info('send', this.getLogParameters(options));
    return this.getRequestFor(signedOptions, payload).send();
  }

  private getRequestFor(requestOptions: ExtendedRequestOption, payload: any) {
    const protocol = (this.options.secure) ? 'https:' : 'http:';
    return new RequestWrapper(requestOptions, protocol, payload);
  }

  private getOptionsFor(method: string, path: string): ExtendedRequestOption {
    const defaultOptions = this.options.toHash();
    const realPath = defaultOptions.prefix + path;

    return Object.assign({}, defaultOptions, {
      method: method,
      url: realPath,
      path: realPath,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent
    });
  }

  private signRequest(options: ExtendedRequestOption, payload: any) {
    const headerNames = options.headers ? options.headers.map(function(header) {
      return header[0];
    }) : [];

    return (this.escher.signRequest(options, payload, headerNames) as ExtendedRequestOption);
  }

  private getLogParameters(options: ExtendedRequestOption) {
    const { method, host, url } = options;
    return { method, host, url };
  }

  private getPayload(data: any) {
    if (this.options?.getHeader('content-type')?.indexOf('application/json') === -1) {
      return data;
    }

    return JSON.stringify(data);
  }
}
