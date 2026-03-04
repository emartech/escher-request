import { AxiosRequestHeaders } from 'axios';
import { expect } from 'chai';
import { EscherRequestError } from './requestError';

describe('EscherRequestError', function() {
  it('should extend base Error class', function() {
    const error = new EscherRequestError('Unauthorized', 401);

    expect(error).to.be.an.instanceOf(Error);
  });

  it('should store constructor parameters', function() {
    const error = new EscherRequestError('Invalid request', 400, {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        headers: {} as AxiosRequestHeaders
      },
      data: {
        replyText: 'Too long',
        detailedMessage: 'Line too long'
      }
    }, 'ECONNABORTED');

    expect(error.message).to.eql('Invalid request');
    expect(error.code).to.eql(400);
    expect(error.data).to.eql({
      replyText: 'Too long',
      detailedMessage: 'Line too long'
    });
    expect(error.originalCode).to.eql('ECONNABORTED');
  });

  it('should store response as is when no data attribute present', function() {
    const error = new EscherRequestError('Invalid request', 400, 'Line too long');

    expect(error.message).to.eql('Invalid request');
    expect(error.code).to.eql(400);
    expect(error.data).to.eql('Line too long');
  });

  it('should always contain data on error', function() {
    const error = new EscherRequestError('Unauthorized', 401);

    expect(error.data).to.eql({ replyText: 'Unauthorized' });
  });
});
