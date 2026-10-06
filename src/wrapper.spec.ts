import axios, { CancelToken } from 'axios';
import http from 'http';
import https from 'https';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import { expect } from 'chai';
import { ExtendedRequestOption, RequestWrapper } from './wrapper';
import { EscherRequestError } from './requestError';
import { AxiosRequestConfig } from 'axios';
import nock from 'nock';
import { IAxiosRetryConfig } from 'axios-retry';

describe('RequestWrapper', function() {
  afterEach(() => {
    nock.cleanAll();
  });
  describe('functionality tests', () => {
    let apiResponse: any;
    let expectedApiResponse: any;
    let extendedRequestOptions: ExtendedRequestOption;
    let expectedRequestOptions: AxiosRequestConfig;
    let cancelToken: CancelToken;

    beforeEach(function() {
      apiResponse = {
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify({ data: 1 }),
        status: 200,
        statusText: 'OK'
      };

      expectedApiResponse = {
        headers: { 'content-type': 'application/json' },
        body: { data: 1 },
        statusCode: 200,
        statusMessage: 'OK'
      };

      extendedRequestOptions = {
        secure: true,
        port: 443,
        host: 'very.host.io',
        rejectUnauthorized: true,
        headers: [
          ['content-type', 'very-format'],
          ['x-custom', 'alma']
        ],
        prefix: '',
        timeout: 15000,
        allowEmptyResponse: false,
        maxContentLength: 10485760,
        keepAlive: false,
        credentialScope: '',
        method: 'GET',
        url: 'http://very.host.io:443/purchases/1/content',
        path: '/purchases/1/content'
      };

      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      cancelToken = source.token;

      expectedRequestOptions = {
        method: 'get',
        url: 'http://very.host.io:443/purchases/1/content',
        data: undefined,
        headers: {
          'content-type': 'very-format',
          'x-custom': 'alma'
        },
        timeout: 15000,
        maxContentLength: 10485760,
        cancelToken: cancelToken
      };
    });

    describe('request handling', function() {
      let wrapper: RequestWrapper;
      let requestGetStub: SinonStub;
      let source: any;

      beforeEach(function() {
        const instanceStub = axios.create();
        sinon.stub(axios, 'create').returns(instanceStub);
        requestGetStub = sinon.stub(instanceStub, 'request');
        requestGetStub.resolves(apiResponse);
        source = {
          token: cancelToken,
          cancel: sinon.stub()
        };
        sinon.stub(axios.CancelToken, 'source').returns(source);

        wrapper = new RequestWrapper(extendedRequestOptions, 'http:');
      });

      it('should send GET request and return its response', async () => {
        const response = await wrapper.send();

        expect(response).to.be.eql(expectedApiResponse);
        const requestArgument = requestGetStub.args[0][0];
        expect(requestArgument).to.containSubset(expectedRequestOptions);
        expect(requestArgument).not.to.have.own.property('httpAgent');
        expect(requestArgument).not.to.have.own.property('httpsAgent');
      });

      it('should pass http agents to axios', async () => {
        const agents = {
          httpAgent: new http.Agent({ keepAlive: true }),
          httpsAgent: new https.Agent({ keepAlive: true })
        };
        wrapper = new RequestWrapper(
          Object.assign(agents, extendedRequestOptions),
          'http:'
        );

        await wrapper.send();

        const requestArgument = requestGetStub.args[0][0];
        expect(requestArgument.httpAgent).to.eql(agents.httpAgent);
        expect(requestArgument.httpsAgent).to.eql(agents.httpsAgent);
      });

      context('error responses', () => {
        it('should return JSON in EscherRequestError if response data is json parsable', async () => {
          requestGetStub.restore();
          nock('http://very.host.io:443')
            .get('/purchases/1/content')
            .reply(400, { replyText: 'Unknown route' }, { 'Content-Type': 'application/json; charset=utf-8' });

          try {
            await wrapper.send();
            throw new Error('Error should have been thrown');
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error).to.be.an.instanceof(EscherRequestError);
            expect(error.message).to.eql('Error in http response (status: 400)');
            expect(error.code).to.eql(400);
            expect(error.data).to.eql({ replyText: 'Unknown route' });
          }
        });

        it('should return text and not fail parsing response data if wrong content-type headers are set', async () => {
          requestGetStub.restore();
          nock('http://very.host.io:443')
            .get('/purchases/1/content')
            .reply(500, 'Unexpected Error', { 'Content-Type': 'application/json; charset=utf-8' });

          try {
            await wrapper.send();
            throw new Error('Error should have been thrown');
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error).to.be.an.instanceof(EscherRequestError);
            expect(error.message).to.eql('Error in http response (status: 500)');
            expect(error.code).to.eql(500);
            expect(error.data).to.eql('Unexpected Error');
          }
        });
      });


      describe('when empty response is allowed', function() {
        beforeEach(function() {
          extendedRequestOptions.allowEmptyResponse = true;
          wrapper = new RequestWrapper(extendedRequestOptions, 'http:');
        });


        it('should allow body to be empty', async () => {
          apiResponse.headers['content-type'] = 'text/html';
          apiResponse.data = '';
          apiResponse.status = 204;

          const response = await wrapper.send();

          expect(response.statusCode).to.eql(204);
        });


        it('should throw error if json is not parsable (empty)', async () => {
          apiResponse.data = '';

          try {
            await wrapper.send();
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error).to.be.an.instanceof(EscherRequestError);
            expect(error.message).to.match(/Unexpected end/);
            expect(error.code).to.eql(500);
            return;
          }
          throw new Error('Error should have been thrown');
        });
      });

      describe('when empty response is not allowed', function() {
        it('should throw error if response body is empty', async () => {
          apiResponse.data = '';

          try {
            await wrapper.send();
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error).to.be.an.instanceof(EscherRequestError);
            expect(error.message).to.eql('Empty http response');
            expect(error.code).to.eql(500);
            expect(error.data).to.eql(expectedApiResponse.statusMessage);
            return;
          }
          throw new Error('Error should have been thrown');
        });

        it('should throw error with status message if response body is empty and status message exists', async () => {
          apiResponse.data = '';
          apiResponse.statusText = 'dummy status message';

          try {
            await wrapper.send();
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error.data).to.eql(apiResponse.statusText);
            return;
          }
          throw new Error('Error should have been thrown');
        });

        it('should throw a http response error even if the response body is empty', async () => {
          requestGetStub.restore();
          nock('http://very.host.io:443')
            .get('/purchases/1/content')
            .reply(404, { replyText: '404 Not Found' });

          try {
            await wrapper.send();
            throw new Error('should throw');
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error).to.be.an.instanceOf(EscherRequestError);
            expect(error.code).to.eql(404);
            expect(error.message).to.eql('Error in http response (status: 404)');
            expect(error.data).to.eql({ replyText: '404 Not Found' });
          }
        });
      });

      describe('when there was an axios error', function() {
        let isCancel: any;
        let axiosError: any;

        beforeEach(function() {
          axiosError = {
            message: 'axios error message',
            stack: []
          };
          isCancel = sinon.stub(axios, 'isCancel');
          requestGetStub.rejects(axiosError);
        });

        context('when the request has not been canceled', function() {
          beforeEach(function() {
            isCancel.returns(false);
          });

          it('cancels the request', async () => {
            try {
              await wrapper.send();
              throw new Error('should throw SuiteRequestError');
            } catch {
              expect(source.cancel).to.have.been.calledWith();
            }
          });
        });

        context('when the request has already been canceled', function() {
          beforeEach(function() {
            isCancel.returns(true);
          });

          it('does not cancel the request', async () => {
            try {
              await wrapper.send();
              throw new Error('should throw SuiteRequestError');
            } catch {
              expect(source.cancel).not.to.have.been.calledWith();
            }
          });
        });

        it('should pass original error code to SuiteRequestError', async () => {
          try {
            axiosError.code = 'ECONNABORTED';

            await wrapper.send();
            throw new Error('should throw SuiteRequestError');
          } catch (err) {
            const error = err as EscherRequestError;
            expect(error.originalCode).to.eql('ECONNABORTED');
            expect(error.code).to.eql(503);
            expect(error.data).to.eql({ replyText: 'axios error message' });
          }
        });
      });


      it('should throw error if json is not parsable (malformed)', async () => {
        apiResponse.data = 'this is an invalid json';

        try {
          await wrapper.send();
        } catch (err) {
          const error = err as EscherRequestError;
          expect(error).to.be.an.instanceof(EscherRequestError);
          expect(error.message).to.match(/Unexpected token/);
          expect(error.code).to.eql(500);
          return;
        }
        throw new Error('Error should have been thrown');
      });

      it('should parse JSON if content-type header contains charset too', async () => {
        const testJson = { text: 'Test JSON text' };
        apiResponse.headers['content-type'] = 'application/json; charset=utf-8';
        apiResponse.data = JSON.stringify(testJson);

        const response = await wrapper.send();

        expect(response.body).to.eql(testJson);
      });

      it('should send GET request with given timeout in options', async () => {
        extendedRequestOptions.timeout = 60000;
        await (new RequestWrapper(extendedRequestOptions, 'http:')).send();

        const requestArgument = requestGetStub.args[0][0];
        expect(requestArgument.timeout).to.eql(extendedRequestOptions.timeout);
      });
    });
  });
  describe('retry test', () => {
    const requestOptions = {
      secure: true,
      port: 443,
      host: 'very.host.io',
      method: 'get',
      url: 'http://very.host.io:443/purchases/1/content',
      path: '/purchases/1/content'
    };

    it('should not retry if error code is below 500', async () => {
      nock('http://very.host.io:443')
        .get('/purchases/1/content').times(1)
        .reply(404, { replyText: '404 Not Found' })
        .get('/purchases/1/content')
        .reply(200, { data: 1 }, { 'content-type': 'application/json' },);
      const retryConfig: IAxiosRetryConfig = { retries: 1 };
      const wrapper = new RequestWrapper({ ...requestOptions, retryConfig }, 'http:', undefined);

      try {
        await wrapper.send();
      } catch (err) {
        const error = err as EscherRequestError;
        expect(error).to.be.an.instanceOf(EscherRequestError);
        expect(error.code).to.eql(404);
        expect(error.message).to.eql('Error in http response (status: 404)');
        expect(error.data).to.eql({ replyText: '404 Not Found' });
      }
    });

    it('should send the request with the correct retry', async () => {
      nock('http://very.host.io:443')
        .get('/purchases/1/content').times(1)
        .reply(500)
        .get('/purchases/1/content')
        .reply(200, { data: 1 }, { 'content-type': 'application/json' },);
      const expectedApiResponse = {
        headers: { 'content-type': 'application/json' },
        body: { data: 1 },
        statusCode: 200
      };
      const retryConfig: IAxiosRetryConfig = { retries: 1 };
      const wrapper = new RequestWrapper({ ...requestOptions, retryConfig }, 'http:', undefined);

      const response = await wrapper.send();

      expect(response).to.containSubset(expectedApiResponse);
    });
  });
});
