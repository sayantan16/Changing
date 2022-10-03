/**
 *
 * �2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

// Author : Atul
var _separator = '/';
function _isDefaultContext(autoscopeFields, ctx) {
  for (var i = 0; i < autoscopeFields.length; ++i) {
    if (ctx[autoscopeFields[i]] !== (_separator + 'default')) {
      return false;
    }
  }
  return true;
}

function _getDefaultContext(autoscope) {
  var ctx = {};
  autoscope.forEach(function (item) {
    ctx[item] = _separator + 'default';
  });
  return ctx;
}


function _getSeparator() {
  return _separator;
}

function _setSeparator(s) {
  _separator = s;
}

var _app;
function _getApp() {
  return _app;
}

function _setApp(app) {
  _app = app;
}


module.exports.getDefaultContext = _getDefaultContext;
module.exports.isDefaultContext = _isDefaultContext;
module.exports.getSeparator = _getSeparator;
module.exports.setSeparator = _setSeparator;
module.exports.getApp = _getApp;
module.exports.setApp = _setApp;


