/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
var async = require('async');
var logger = require('oe-logger');
var log = logger('ui-manager');
var loopback = require('loopback');

/**
 * @classdesc This non-persisted model provides some utility end-points for ui-admin.
 * `generate` (/generate/:modelname) method, generates a default nav-link, ui-route and ui-metadata to display model form.
 *
 * @kind class
 * @class UIManager
 * @author Rohit Khode
 */

module.exports = function UIManager(UIManager) {
  function _findAndCreate(model, filter, data, response, options, next) {
    log.debug(options, '_findAndCreate', model.definition.name, filter);

    model.find({
      where: filter
    }, options, function modelFindCb(err, records) {
      if (err) {
        return next(err);
      }
      if (records && records.length > 0) {
        response.messages.push(model.definition.name + '-already-defined');
        return next();
      }
      model.create(data, options, function modelCreateCb(err, data) {
        log.debug(options, model.definition.name + ' Created', err, data);
        if (err) {
          return next(err);
        }
        response.messages.push(model.definition.name + '-created');
        return next();
      });
    });
  }

  UIManager.generate = function UIManagerUiGen(modelname, options, cb) {
    var self = this;

    var app = self.app;

    if (!cb && typeof options === 'function') {
      cb = options;
      options = {};
    }

    var model = loopback.findModel(modelname, options);
    if (model) {
      var newMetadata = {
        name: modelname,
        modelName: model.definition.name,
        fields: []
      };

      for (var pName in model.definition.rawProperties) {
        if (pName[0] !== '_' && pName !== 'id') {
          newMetadata.fields.push(pName);
        }
      }

      var navLinkData = {
        name: modelname,
        label: modelname,
        url: '/forms/' + modelname + '-form',
        topLevel: true,
        group: 'root'
      };

      var uiRouteData = {
        name: 'forms',
        path: '/forms/:formname',
        type: 'elem',
        import: app.get('restApiRoot') + '/UIComponents/component/:formname'
      };

      var response = {
        status: true,
        messages: []
      };
      async.series([
        function handleUIComponent(next) {
          _findAndCreate(app.models.UIComponent, {
            name: modelname
          }, newMetadata, response, options, next);
        },
        function handleNavigationLink(next) {
          _findAndCreate(app.models.NavigationLink, navLinkData, navLinkData, response, options, next);
        },
        function handleUIRoute(next) {
          _findAndCreate(app.models.UIRoute, uiRouteData, uiRouteData, response, options, next);
        }
      ], function callbackFn(err) {
        cb(err, response);
      });
    } else {
      cb({
        status: 422,
        message: 'invalid-model-name'
      });
    }
  };

  UIManager.remoteMethod('generate', {
    returns: [{
      type: 'object',
      root: true,
      description: 'return value'
    }],
    accepts: [{
      arg: 'modelname',
      type: 'string',
      required: true,
      http: {
        source: 'path'
      }
    }],
    http: {
      path: '/generate/:modelname',
      verb: 'post'
    }
  });
};
