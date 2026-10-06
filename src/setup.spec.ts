import chai from 'chai';
import { afterEach } from 'mocha';
import sinon from 'sinon';
import chaiSinon from 'sinon-chai';

chai.use(chaiSinon);

afterEach(function() {
  sinon.restore();
});
