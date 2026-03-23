import sinon, { SinonStub } from 'sinon';
import { expect } from 'chai';
import axios from 'axios';
const Escher = require('escher-auth');
import http from 'http';
import https from 'https';
import { EscherRequest, EscherRequestOption } from './request';
import nock from 'nock';
import { IAxiosRetryConfig } from 'axios-retry';

describe('EscherRequest', function() {
  const serviceConfig = {
    host: 'localhost',
    port: 1234,
    prefix: '/api',
    rejectUnauthorized: false,
    secure: true,
    credentialScope: 'eu/dummy/ems_request'
  };

  const createDummyResponse = function() {
    return {
      headers: {},
      data: 'response body dummy'
    };
  };

  let requestOptions: EscherRequestOption;
  let requestStub: SinonStub;
  let escherRequest: EscherRequest;

  beforeEach(function() {
    requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
    const instanceStub = axios.create();
    sinon.stub(axios, 'create').returns(instanceStub);
    requestStub = sinon.stub(instanceStub, 'request').resolves(createDummyResponse());
    escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should sign headers of GET request', async () => {
    await escherRequest.get('/path');

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth']).to.have.string('SignedHeaders=content-type;host;x-ems-date,');
  });

  it('should sign headers of PATCH request', async () => {
    await escherRequest.patch('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth']).to.have.string('SignedHeaders=content-type;host;x-ems-date,');
  });

  it('should sign headers of POST request', async () => {
    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth']).to.have.string('SignedHeaders=content-type;host;x-ems-date,');
  });

  it('should sign headers of DELETE request', async () => {
    await escherRequest.delete('/path');

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth']).to.have.string('SignedHeaders=content-type;host;x-ems-date,');
  });

  it('should sign headers with non string values', async () => {
    requestOptions.setHeader(['x-customer-id', '15']);

    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth']).to.have.string('content-type;host;x-customer-id;x-ems-date,');
  });

  it('should encode payload when content type is json', async () => {
    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.data).to.eql('{"name":"Almanach"}');
  });

  it('should encode payload when content type is json and method is GET', async () => {
    await escherRequest.get('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.data).to.eql('{"name":"Almanach"}');
  });

  it('should encode payload when content type is utf8 json', async () => {
    requestOptions.setHeader(['content-type', 'application/json;charset=utf-8']);

    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.data).to.eql('{"name":"Almanach"}');
  });

  it('should skip encoding of payload when content type is not json', async () => {
    requestOptions.setHeader(['content-type', 'text/csv']);

    await escherRequest.post('/path', 'header1;header2');

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.data).to.eql('header1;header2');
  });

  it('signs extra headers too', async () => {
    requestOptions.setHeader(['extra-header', 'header-value']);

    await escherRequest.get('/path');

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.headers['x-ems-auth'])
      .to.have.string('SignedHeaders=content-type;extra-header;host;x-ems-date,');
  });

  it('should pass down parameters to request call from request options', async () => {
    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];

    expect(requestArgument).to.contain({
      method: 'post',
      url: 'https://localhost:1234/api/path',
      data: '{"name":"Almanach"}',
      timeout: 15000,
      maxContentLength: 10485760
    });
  });

  it('should sign the payload of PATCH request', async function() {
    const payload = { name: 'Test' };
    sinon.spy(Escher.prototype, 'signRequest');

    await escherRequest.patch('/path', payload);

    expect(Escher.prototype.signRequest.callCount).to.eql(1);
    const firstCall = Escher.prototype.signRequest.getCall(0);
    expect(firstCall.args[1]).to.eql(JSON.stringify(payload));
  });

  it('should sign the payload of POST request', async function() {
    const payload = { name: 'Test' };
    sinon.spy(Escher.prototype, 'signRequest');

    await escherRequest.post('/path', payload);

    expect(Escher.prototype.signRequest.callCount).to.eql(1);
    const firstCall = Escher.prototype.signRequest.getCall(0);
    expect(firstCall.args[1]).to.eql(JSON.stringify(payload));
  });

  it('should sign the payload of GET request', async function() {
    const payload = { name: 'Test' };
    sinon.spy(Escher.prototype, 'signRequest');

    await escherRequest.get('/path', payload);

    expect(Escher.prototype.signRequest.callCount).to.eql(1);
    const firstCall = Escher.prototype.signRequest.getCall(0);
    expect(firstCall.args[1]).to.eql(JSON.stringify(payload));
  });

  it('should not create http agents by default', function() {
    escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

    expect(escherRequest.httpAgent).to.be.undefined;
    expect(escherRequest.httpsAgent).to.be.undefined;
  });

  it('should create http agents when connection is keep alive', function() {
    requestOptions = new EscherRequestOption(serviceConfig.host, Object.assign({ keepAlive: true }, serviceConfig));

    escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

    expect(escherRequest.httpAgent).to.be.an.instanceOf(http.Agent);
    expect(escherRequest.httpsAgent).to.be.an.instanceOf(https.Agent);
  });

  it('should pass http agents to wrapper', async () => {
    requestOptions = new EscherRequestOption(serviceConfig.host, Object.assign({ keepAlive: true }, serviceConfig));
    escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

    await escherRequest.post('/path', { name: 'Almanach' });

    const requestArgument = requestStub.args[0][0];
    expect(requestArgument.httpAgent).to.eql(escherRequest.httpAgent);
    expect(requestArgument.httpsAgent).to.eql(escherRequest.httpsAgent);
  });

  it('should retry the request if retryConfig exists', async () => {
    requestStub.restore();
    nock('https://localhost:1234')
      .get('/api/purchases/1/content').times(1)
      .reply(500)
      .get('/api/purchases/1/content')
      .reply(200, { data: 1 }, { 'content-type': 'application/json' },);
    const retryConfig: IAxiosRetryConfig = { retries: 1 };
    requestOptions = new EscherRequestOption(serviceConfig.host, { ...serviceConfig, retryConfig });
    escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

    const response = await escherRequest.get('/purchases/1/content');

    expect(response.statusCode).to.eql(200);
    expect(response.body).to.eql({ data: 1 });
  });

  describe('proxy support', function() {
    let originalHttpProxy: string | undefined;
    let originalHttpsProxy: string | undefined;
    let originalNoProxy: string | undefined;

    beforeEach(function() {
      originalHttpProxy = process.env.HTTP_PROXY;
      originalHttpsProxy = process.env.HTTPS_PROXY;
      originalNoProxy = process.env.NO_PROXY;
    });

    afterEach(function() {
      if (originalHttpProxy) {
        process.env.HTTP_PROXY = originalHttpProxy;
      } else {
        delete process.env.HTTP_PROXY;
      }
      if (originalHttpsProxy) {
        process.env.HTTPS_PROXY = originalHttpsProxy;
      } else {
        delete process.env.HTTPS_PROXY;
      }
      if (originalNoProxy) {
        process.env.NO_PROXY = originalNoProxy;
      } else {
        delete process.env.NO_PROXY;
      }
    });

    it('should create proxy agents when HTTPS_PROXY environment variable is set', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should create proxy agents when HTTP_PROXY environment variable is set for insecure connections', function() {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      const insecureConfig = { ...serviceConfig, secure: false };
      requestOptions = new EscherRequestOption(serviceConfig.host, insecureConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should create proxy agents when proxy option is explicitly set', function() {
      const configWithProxy = { ...serviceConfig, proxy: 'http://explicit-proxy.example.com:3128' };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithProxy);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should prioritize explicit proxy option over environment variables', function() {
      process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
      const configWithProxy = { ...serviceConfig, proxy: 'http://explicit-proxy.example.com:3128' };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithProxy);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should not create proxy agents when no proxy is configured', function() {
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      const configWithoutKeepAlive = { ...serviceConfig, keepAlive: false };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithoutKeepAlive);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.be.undefined;
      expect(escherRequest.httpsAgent).to.be.undefined;
    });

    it('should combine proxy and keepAlive settings', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      const configWithKeepAlive = { ...serviceConfig, keepAlive: true };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithKeepAlive);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should support lowercase environment variables', function() {
      process.env.https_proxy = 'http://proxy.example.com:8080';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;

      delete process.env.https_proxy;
    });

    it('should respect NO_PROXY environment variable for exact host match', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'localhost';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.be.undefined;
      expect(escherRequest.httpsAgent).to.be.undefined;
    });

    it('should respect NO_PROXY environment variable with wildcard', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = '*.local,localhost,.internal.example.com';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.be.undefined;
      expect(escherRequest.httpsAgent).to.be.undefined;
    });

    it('should use proxy when host is not in NO_PROXY', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'other.host.com';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });

    it('should respect no_proxy (lowercase) environment variable', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.no_proxy = 'localhost';
      requestOptions = new EscherRequestOption(serviceConfig.host, serviceConfig);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.be.undefined;
      expect(escherRequest.httpsAgent).to.be.undefined;

      delete process.env.no_proxy;
    });

    it('should respect NO_PROXY with non-standard port', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'localhost';
      const configWithNonStandardPort = { ...serviceConfig, port: 8443 };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithNonStandardPort);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.be.undefined;
      expect(escherRequest.httpsAgent).to.be.undefined;
    });

    it('should use proxy with non-standard port when host not in NO_PROXY', function() {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'other.host.com';
      const configWithNonStandardPort = { ...serviceConfig, port: 8443 };
      requestOptions = new EscherRequestOption(serviceConfig.host, configWithNonStandardPort);
      escherRequest = EscherRequest.create('key-id', 'secret', requestOptions);

      expect(escherRequest.httpAgent).to.exist;
      expect(escherRequest.httpsAgent).to.exist;
    });
  });
});
