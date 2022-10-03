/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

const loopback = require('loopback');
const rootModel = loopback.findModel('Model');
module.exports = function (option) {
  return function (req, res, next) {
    if (req.accessToken && req.accessToken.ctx) {
      if ( !req.callContext) {
        req.callContext = { ctx: {}};
      }
      if (!req.callContext.ctx) {
        req.callContext.ctx = {};
      }
      Object.keys(req.accessToken.ctx).forEach(function (k) {
        if (req.accessToken.ctx.hasOwnProperty(k)) {
          req.callContext.ctx[k] = req.accessToken.ctx[k];
        }
      });
    }
    if (rootModel && rootModel.setCallContext) {
      req.callContext = rootModel.setCallContext(req);
    }
    return next();
  };
};

