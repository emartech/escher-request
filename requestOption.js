'use strict';

var _ = require('lodash');

var SuiteRequestOption = function(environment, options) {
  this.secure = options.secure !== false;
  this.port = options.port || 443;
  this.host = environment;
  this.rejectUnauthorized = options.rejectUnauthorized !== false;
  this.headers = [['content-type', 'application/json'], ['host', environment]];
  this.prefix = '';
  this.timeout = 'timeout' in options ? options.timeout : 15000;

  if (!options) {
    options = {};
  }
  _.extend(this, options);
};

SuiteRequestOption.prototype = {

  setToSecure: function(port, rejectUnauthorized) {
    this.port = port || 443;
    this.secure = true;
    this.rejectUnauthorized = rejectUnauthorized;
  },

  setToUnsecure: function(port) {
    this.port = port || 80;
    this.secure = false;
  },

  setEnvironment: function(environment) {
    this.host = environment;
  },

  setPort: function(port) {
    this.port = port;
  },

  setHeader: function(headerToSet) {
    this.headers = this.headers
      .filter(this._headersExcept(headerToSet[0]))
      .concat([headerToSet]);
  },

  getHeader: function(name) {
    var result = _.find(this.headers, function(header) {
      return header[0].toLowerCase() === name.toLowerCase();
    });

    return result ? result[1] : null;
  },

  setTimeout: function(timeout) {
    this.timeout = timeout;
  },

  getTimeout: function() {
    return this.timeout;
  },

  toHash: function() {
    var hash = {
      port: this.port,
      host: this.host,
      headers: this.headers,
      prefix: this.prefix,
      timeout: this.timeout
    };

    if (!this.rejectUnauthorized) {
      hash.rejectUnauthorized = false;
    }

    return hash;
  },

  _headersExcept: function(headerKeyToSkip) {
    return function(existingHeader) {
      return existingHeader[0] !== headerKeyToSkip;
    };
  }
};

SuiteRequestOption.createForInternalApi = function(environment, rejectUnauthorized) {
  return createSuiteRequestOption('/api/v2/internal', environment, rejectUnauthorized);
};

SuiteRequestOption.createForServiceApi = function(environment, rejectUnauthorized) {
  return createSuiteRequestOption('/api/services', environment, rejectUnauthorized);
};

SuiteRequestOption.create = function(environment, prefix, rejectUnauthorized) {
  return createSuiteRequestOption(prefix, environment, rejectUnauthorized);
};

var createSuiteRequestOption = function(prefix, environment, rejectUnauthorized) {
  var options = {};

  if (typeof environment === 'object') {
    options = environment;
    environment = options.environment;
  } else {
    options.rejectUnauthorized = rejectUnauthorized;
  }

  options.prefix = prefix;

  return new SuiteRequestOption(environment, options);
};


module.exports = SuiteRequestOption;
