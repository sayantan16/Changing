/**
 *
 * 2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

const wrapper = require('./lib/wrapper.js');
const logger = require('oe-logger');
const log = logger('oe-common-mixins');
module.exports = function (app) {
  if (!app) {
    app = require('oe-cloud');
  }
  wrapper(app);
  var options = app.options;
  if (options && options.models && options.models._meta && Array.isArray(options.models._meta.mixins)) {
    var item = options.models._meta.mixins.find(function (i) {
      if (typeof i === 'string' && i.toLowerCase().indexOf('oe-common-mixins') >= 0) {return true;}
    });
    log.debug(log.defaultContext(), 'oe-common-mixin already present in list ? ' + (item ? 'no' : 'yes'));
    if (!item) {options.models._meta.mixins.push('oe-common-mixins/common/mixins');}
  } else {
    log.error(log.defaultContext(), 'Could not load mixins by itself');
  }
};

