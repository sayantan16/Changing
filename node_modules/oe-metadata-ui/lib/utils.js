/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
var loopback = require('loopback');
var _ = require('lodash');
var log = require('oe-logger')('UIUtils');

function _isHiddenProperty(model, propName, options) {
  var settings = model.definition.settings;
  if (settings.hidden && settings.hidden.indexOf(propName) >= 0) {
    return true;
  }
  if (options.skipSystemFields) {
    if (propName === 'id' || propName === 'scope' || propName.startsWith('_')) {
      return true;
    }
  }
  return false;
}

// generate model definition
function _extractMeta(model, options, allDefinitions) {
  var properties = {};
  var associations = [];
  var premitives = ['String', 'Number', 'Boolean', 'Date', 'Object'];
  Object.keys(model.definition.properties).forEach(function forEachPropertyCB(propName) {
    if (!_isHiddenProperty(model, propName, options)) {
      var propDetails = _.cloneDeep(model.definition.properties[propName]);
      if (propDetails.evtype) {
        propDetails.type = propDetails.evtype;
      }
      if (typeof propDetails.type === 'function') {
        if (propDetails.type.name === 'ModelConstructor' || premitives.indexOf(propDetails.type.name) < 0) {
          /* Property value is composite model */
          if (propDetails.type.definition) {
            associations.push(propDetails.type);
            propDetails.modeltype = propDetails.type.definition.name;
            propDetails.type = 'model';
          }
        } else {
          /* Property value is primitive like string, date, number, boolean etc. */
          propDetails.type = propDetails.type.name.toLowerCase();
        }
      } else if (Array.isArray(propDetails.type)) {
        /* type is an array */
        var itemType = propDetails.type[0];
        if (typeof itemType === 'function') {
          /* Array of another model */
          if (itemType.name === 'ModelConstructor' || premitives.indexOf(itemType.name) < 0) {
            associations.push(itemType);
            propDetails.itemtype = 'model';
            propDetails.modeltype = itemType.definition.name;
          } else {
            /* Array of primitive */
            propDetails.itemtype = itemType.name.toLowerCase();
          }
        }
        propDetails.type = 'array';
      }
      if (propDetails.refcodetype) {
        associations.push(loopback.findModel(propDetails.refcodetype, options));
      }
      if (propDetails.enumtype) {
        var enumModel = model.app.models[propDetails.enumtype];
        if (enumModel) {
          // enumtype is pointing to model
          propDetails.listdata = enumModel.settings.enumList;
        } else {
          // enumtype is not pointing to model
          log.error(options, 'error finding enumtype ', propDetails.enumtype);
        }
      }
      properties[propName] = propDetails;
    }
  });

  var relations = model.relations;
  var modelDefn = {
    id: model.definition.name,
    base: model.base.modelName,
    plural: model.pluralModelName,
    resturl: model.app.get('restApiRoot') + model.http.path,
    properties: properties,
    relations: relations
  };

  allDefinitions[model.definition.name] = modelDefn;
  if (model.clientModelName && model.clientModelName !== model.definition.name) {
    allDefinitions[model.clientModelName] = modelDefn;
  }

  if (options.dependencies) {
    Object.keys(relations).forEach(function relationsForEachKey(relationName) {
      var related = relations[relationName].modelTo;
      associations.push(related);
    });

    for (var i = 0; i < associations.length; i++) {
      var associated = associations[i];
      if (associated) {
        if (!allDefinitions[associated.definition.name]) {
          _extractMeta(associated, options, allDefinitions);
        }
      }
    }
  }
}

function _flattenMetadata(modelName, allModels) {
  var flatProperties = {};

  var modelDefnMeta = allModels[modelName] || {
    properties: {}
  };

  for (var propName in modelDefnMeta.properties) {
    if (propName !== 'id') {
      var propObj = modelDefnMeta.properties[propName];

      /* if type of this property is not present in all models, then it should be a primitive property.*/
      if (propObj.type === 'model') {
        /**
         * It is a composite type. We need sub-model's properties add thos multiple fields
         * User{
         *  address : Address
         * }
         * We flatten Address and add address.line1, address.city etc into our control-list.
         */
        var subObj = _flattenMetadata(propObj.modeltype, allModels);
        for (var subProp in subObj.properties) {
          if (subObj.properties.hasOwnProperty(subProp)) {
            flatProperties[propName + '.' + subProp] = subObj.properties[subProp];
          }
        }
      } else {
        /* a primitive property*/
        flatProperties[propName] = propObj;
      }
    }
  }
  modelDefnMeta.properties = flatProperties;
  return modelDefnMeta;
}

function extractMeta(modelName, options, callback) {
  options = options || {};
  if (options.flatten) {
    options.dependencies = true;
  }
  var model = loopback.findModel(modelName, options);
  var result = {};
  if (model) {
    var allDefinitions = {};
    _extractMeta(model, options, allDefinitions);

    /**
     * If we are returning a different personalized model against the requested one,
     * also make sure this is available under original requested name
     */
    if (model.clientModelName !== modelName) {
      allDefinitions[modelName] = allDefinitions[model.modelName];
    }
    result = allDefinitions;
    if (options.flatten) {
      /**
       * Inter-weave the embedded Model's field as sub-fields.
       */
      result = _flattenMetadata(model.modelName, allDefinitions);
    }
  }
  callback && callback(null, result);
  return result;
}

module.exports = {
  extractMeta: extractMeta
};
