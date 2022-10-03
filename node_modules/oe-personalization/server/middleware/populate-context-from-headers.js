/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

var util = require('oe-cloud/lib/common/util');
var camelCase = require('camelcase');

var excludeHeadersList = [];
var queryStringContext = [];

function setContextValue(callContext, key, valueobj) {
  var newkey = key;
  if (key === 'x-evproxy-context') {
    var str = Buffer.from(valueobj[key], 'base64').toString('utf8');
    callContext.evproxyContext = JSON.parse(str);
  } else if (key.indexOf('x-ctx-weight-') === 0) {
    newkey = newkey.replace('x-ctx-weight-', '');
    if (!callContext.ctxWeights) {
      callContext.ctxWeights = {};
    }
    callContext.ctxWeights[camelCase(newkey)] = valueobj[key];
  } else if (key.indexOf('x-') === 0) {
    newkey = newkey.replace('x-', '');
    callContext[camelCase(newkey)] = valueobj[key];
  } else {
    callContext.ctx[camelCase(key)] = valueobj[key];
  }
}

module.exports = function (options) {
  excludeHeadersList = options.excludeHeadersList || [];
  queryStringContext = options.queryStringContext || [];

  return function (req, res, next) {
    var headerKeys = Object.keys(req.headers);
    var callContext = {ctx: {}};

    headerKeys.map(function headerKeysmapFn(key, index) {
      if (excludeHeadersList.indexOf(key) === -1) {
        setContextValue(callContext, key, req.headers);
      }
    });

    // From Query Parameters only few things should be overridable
    // on top of headers, so have a positive list for these
    // var queryKeys = Object.keys(queryStringContext);
    queryStringContext.map(function queryKeysMapFn(key, index) {
      if (req.query && req.query[key]) {
        setContextValue(callContext, key, req.query);
      }
    });

    var langKey = 'accept-language';
    if (!callContext.ctx.lang && req.headers[langKey]) {
      callContext.ctx.lang = req.headers[langKey].split(',')[0];
    }

    if (!req.callContext) {
      req.callContext = callContext;
    } else {
      req.callContext = util.mergeObjects(req.callContext, callContext);
    }
    return next();
  };
};

