import { EscherRequestError } from './requestError';
import { RequestOptions } from './requestOption';
import {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseHeaders,
  CancelTokenSource,
  RawAxiosResponseHeaders
} from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import axios from 'axios';
import { createLogger } from '@emartech/json-logger';
import axiosRetry from 'axios-retry';
const logger = createLogger('suiterequest');
const debugLogger = createLogger('suiterequest-debug');

export interface ExtendedRequestOption extends RequestOptions {
  method: string;
  url: string;
  path: string;
  httpAgent?: HttpAgent;
  httpsAgent?: HttpsAgent;
}

export interface TransformedResponse<T = any> {
  body: T,
  statusCode: number;
  statusMessage: string;
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders
}

export class RequestWrapper {
  private readonly protocol: string;
  private readonly payload: any;
  private readonly requestOptions: ExtendedRequestOption;

  constructor(
    requestOptions: ExtendedRequestOption,
    protocol: string,
    payload: any = undefined,
  ) {
    this.requestOptions = requestOptions;
    this.protocol = protocol;
    this.payload = payload;
    debugLogger.info('request_options', {
      request_options: requestOptions,
      protocol: protocol,
      payload: payload
    });
  }

  public send<T = any>(): Promise<TransformedResponse<T>> {
    const timer = logger.timer();

    const method = this.requestOptions.method.toLowerCase();
    const retryConfig = this.requestOptions.retryConfig;
    const reqOptions = this.getRequestOptions();
    const source = axios.CancelToken.source();

    const axiosOptions: AxiosRequestConfig = {
      method,
      url: reqOptions.url,
      headers: reqOptions.headers,
      data: reqOptions.data,
      timeout: reqOptions.timeout,
      transformResponse: [body => body],
      maxContentLength: this.requestOptions.maxContentLength,
      cancelToken: source.token
    };

    if (this.requestOptions.httpAgent && this.requestOptions.httpsAgent) {
      axiosOptions.httpAgent = this.requestOptions.httpAgent;
      axiosOptions.httpsAgent = this.requestOptions.httpsAgent;
    }

    const client = axios.create();

    if (retryConfig) {
      axiosRetry(client, retryConfig);
    }

    return client
      .request(axiosOptions)
      .then(
        response => this.transformResponse(response),
        error => this.handleResponseError(error, source)
      )
      .then((response: any) => {
        timer.info('send', this.getLogParameters());

        return this.handleResponse(response);
      });
  }

  private transformResponse(response: AxiosResponse): TransformedResponse {
    return {
      body: response.data,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: response.headers
    };
  }

  private handleResponseError(error: AxiosError, source: CancelTokenSource) {
    if (error.response?.status) {
      logger.error('server_error', this.getLogParameters({
        code: error.response.status,
        reply_text: (error.response?.data || '')
      }));
      let data = '';
      if (error.response != null &&
          this.isJsonResponse(error.response) &&
            error.response.data != null &&
            typeof error.response.data === 'string') {
        try {
          data = JSON.parse(error.response.data);
        } catch {
          data = error.response.data;
        }
      }

      throw new EscherRequestError(
        'Error in http response (status: ' + error.response.status + ')',
        error.response.status,
        data
      );
    } else {
      if (!axios.isCancel(error)) {
        source.cancel();
        logger.info('Canceled request');
      }
      logger.fromError('fatal_error', error, this.getLogParameters());

      const recoverableErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNABORTED'];
      const code = recoverableErrorCodes.includes(error.code || '') ? 503 : 500;

      throw new EscherRequestError(error.message, code, undefined, error.code);
    }
  }

  private handleResponse<T = any>(response: TransformedResponse): TransformedResponse<T> {
    if (!this.requestOptions.allowEmptyResponse && !response.body) {
      logger.error('server_error empty response data', this.getLogParameters());
      throw new EscherRequestError('Empty http response', 500, response.statusMessage);
    }

    return {
      body: this.parseBody(response),
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      headers: response.headers
    };
  }

  private isJsonResponse<T extends TransformedResponse | AxiosResponse>(response: T) {
    return typeof response.headers['content-type'] === 'string'
      && response.headers['content-type'].includes('application/json');
  }

  private getLogParameters(extraParametersToLog = {}) {
    const { method, host, url } = this.requestOptions;
    const requestParametersToLog = { method, host, url };
    return Object.assign({}, requestParametersToLog, extraParametersToLog);
  }

  private getRequestOptions() {
    const headers: Record<string, string> = {};

    if (this.requestOptions.headers) {
      this.requestOptions.headers.forEach(function(header) {
        headers[header[0]] = header[1];
      });
    }

    const reqOptions: AxiosRequestConfig = {
      url: `${this.protocol}//${this.requestOptions.host}:${this.requestOptions.port}${this.requestOptions.path}`,
      headers: headers,
      timeout: this.requestOptions.timeout
    };
    debugLogger.info('wrapper_options', reqOptions);

    if (this.payload) {
      reqOptions.data = this.payload;
    }

    return reqOptions;
  }

  private parseBody(response: TransformedResponse) {
    if (!this.isJsonResponse(response)) {
      return response.body;
    }

    try {
      return JSON.parse(response.body);
    } catch (ex) {
      logger.fromError('fatal_error', ex, this.getLogParameters());
      throw new EscherRequestError((ex as Error).message, 500);
    }
  }
}
