/**
 *
 * �2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

// Author : Atul
const loopback = require('loopback');
const oecloudutil = require('oe-cloud/lib/common/util');

function _getChildModelCreateFunc(parentData, childModel, cr) {
  var obj = { func: '', payload: '' };
  var childModelKeyId = oecloudutil.idName(childModel);
  if (parentData.hasManyThrough && cr[childModelKeyId]) {
    obj.payload = { parentData: parentData, childModel: childModel, cr: cr };
    // function which does hasManyThrough create or add only through model data
    obj.func = childLinkOrCreate;
  } else {
    obj.payload = cr;
    obj.func = parentData.inst[parentData.relationName].create;
  }
  return obj;
}

function childLinkOrCreate(dtl, options, cb) {
  // HasManyThrough - Skip toModel Create, if data exist and create record in through Model only.
  dtl.childModel.findById(dtl.cr[oecloudutil.idName(dtl.childModel)], options, function (err, toModelInst) {
    if (err) {
      return cb(err);
    }
    if (toModelInst) {
      var throughApiName = '__link__' + dtl.parentData.relationName;
      var throughData = null;
      dtl.parentData.inst[throughApiName](toModelInst, throughData, options, function (err2, inst2) {
        return cb(err2, toModelInst);
      });
    } else {
      dtl.parentData.inst[dtl.parentData.relationName].create(dtl.cr, options, function (err3, createdRecord2) {
        return cb(err3, createdRecord2);
      });
    }
  });
}

module.exports.getChildModelCreateFunc = _getChildModelCreateFunc;

// / Atul : applyRecord() will check the status of the record and actually call model's method to do create/update/delete operation on model.
// / it will put id field (pk) in where clause for update and delete operation.
// model - model object
// pk - primarky keys of model
// options - whatever is passed - mostly to do with begin/end transaction
// r - actual record to create/delete/update
// cb - callbackck
module.exports.applyRecord = function applyRecord(parentData, model, pk, options, r, cb) {
  //  var modelParameter2 = model;
  var rowStatus = r.__row_status;
  delete r.__row_status;
  if (rowStatus !== 'added' && rowStatus !== 'modified' && rowStatus !== 'deleted') {
    return cb();
  }
  try {
    if (rowStatus === 'added') {
      // For hasMany or hasManyThrough Implicit PUT/id
      if (parentData) {
        var childModelCreate = _getChildModelCreateFunc(parentData, model, r);
        childModelCreate.func(childModelCreate.payload, options, function (err, instance) {
          cb(err, instance);
        });
      } else {
        model.create(r, options, function (err, instance) {
          cb(err, instance);
        });
      }
    } else if (pk.length > 0) {
      var w = [];
      for (var j = 0; j < pk.length; ++j) {
        var x = Object.keys(pk[j])[0];
        var o = {};
        o[x] = r[x];
        // w[x] = r[x];
        w.push(o);
      }
      if (rowStatus === 'modified') {
        model.upsert(r, options, function (err, instance) {
          cb(err, instance);
        });
      } else {
        // For hasManyThrough Implicit DELETE
        if (parentData && parentData.hasManyThrough) {
          var locPayload = { parentData: parentData, childModel: model, cr: r };
          childUnlink(locPayload, options, function (err2, inst2) {
            return cb(err2, inst2);
          });
        } else {
          var whereClause = '';
          if (w.length === 1) {
            whereClause = w[0][Object.keys(w[0])];
            // var whereClause = w[0].id;
            /* istanbul ignore if */
            if (model.deleteWithVersion) {
              var version = r._version;
              model.deleteWithVersion(whereClause, version, options, function (err, instance) {
                cb(err);
              });
            } else {
              model.deleteById(whereClause, options, function (err, instance) {
                // do not return instance for delete operation.
                // cb(err/* , instance*/);
                cb(err);
              });
            }
          } else {
            whereClause = { and: w };
            model.destroyAll(whereClause, options, function (err, instance) {
              // do not return instance for delete operation.
              cb(err, instance);
            });
          }
        }
      }
    } else {
      return cb(new Error('No primary key defined'));
    }
  } catch (err) {
    return cb(err);
  }
};

function childUnlink(dtl, options, cb) {
  // HasManyThrough - unlink record in through Model only.
  dtl.childModel.findById(dtl.cr[oecloudutil.idName(dtl.childModel)], options, function (err, toModelInst) {
    if (err || !toModelInst) {
      return cb(err);
    }
    var throughApiName = '__unlink__' + dtl.parentData.relationName;
    dtl.parentData.inst[throughApiName](toModelInst, options, function (err2, inst2) {
      return cb(err2, inst2);
    });
  });
}


// / Atul : this function returns a list of id fields of model.
// / we can use idNames() also. but i kept it for a while. once tested, it can be removed and better method can be used.
// TODO : use of idNames().
module.exports.getIdFields = function getIdFields(model) {
  var flagIdField = false;
  var pk = [];

  if (typeof model === 'string') {
    model = loopback.getModel(model);
  }

  // var pkNames = model.definition.idNames();
  for (var p in model.definition.properties) {
    if (model.definition.properties.hasOwnProperty(p)) {
      var property = model.definition.properties[p];

      if (p === 'id') {
        flagIdField = true;
      }

      if (property.id) {
        var x = {};
        x[p] = property;
        pk.push(x);
      }
    }
  }
  if (pk.length === 0) {
    if (!flagIdField) { return pk; }
    return [{
      id: model.definition.properties.id
    }];
  }
  return pk;
};

module.exports.getChildDataAndRelations = function getChildDataAndRelations(self, data) {
  // Atul : relation is object that fetches all child relation of model for which data is being posted.
  var relations = {};
  for (var r in self.relations) {
    if (self.relations[r].type === 'hasMany' || self.relations[r].type === 'hasOne' || self.relations[r].type === 'belongsTo') {
      if (self.relations[r].modelTo) {
        relations[r] = self.relations[r].modelTo.modelName;
      }
    }
  }
  if (!data) {
    return relations;
  }

  // Atul : childData holds nested related data of model. only one level nesting is supported
  var childData = false;
  for (var relName in relations) {
    if (!data[relName]) { continue; }
    if (typeof data[relName] === 'function') { continue; }
    if (!childData) { childData = {}; }
    childData[relName] = data[relName];
    delete data[relName];
  }

  return { childData, relations };
};


// / Atul : applyRecordExplicit() will check the status of the record and actually call model's method to do create/update/delete operation on model.
// / it will put id field (pk) in where clause for update and delete operation.
// model - model object
// pk - primarky keys of model
// options - whatever is passed - mostly to do with begin/end transaction
// r - actual record to create/delete/update
// cb - callbackc
// This function is used only by exlicitPost - later it will be merged with applyRecord
module.exports.applyRecordExplicit = function applyRecord(modelParameter, pk, options, r, cb) {
  var model = modelParameter;
  var rowStatus = r.__row_status;
  delete r.__row_status;
  try {
    if (rowStatus === 'added') {
      model.create(r, options, function (err, instance) {
        cb(err, instance);
      });
    } else if (rowStatus === 'modified' || rowStatus === 'deleted') {
      if (pk.length > 0) {
        var w = [];
        for (var j = 0; j < pk.length; ++j) {
          var x = Object.keys(pk[j])[0];
          var o = {};
          o[x] = r[x];
          // w[x] = r[x];
          w.push(o);
        }
        var whereClause;
        if (rowStatus === 'modified') {
          model.upsert(r, options, function (err, instance) {
            cb(err, instance);
          });
        } else if (w.length === 1) {
          whereClause = w[0].id;
          /* istanbul ignore if */
          if (model.deleteWithVersion) {
            var version = r._version;
            model.deleteWithVersion(whereClause, version, options, function (err, instance) {
              cb(err);
            });
          } else {
            model.deleteById(whereClause, options, function (err, instance) {
              cb(err);
            });
          }
        } else {
          whereClause = {
            and: w
          };
          model.destroyAll(whereClause, options, function (err, instance) {
            cb(err);
          });
        }
      } else if (rowStatus === 'modified') {
        model.updateAttributes(r, options, function (err, instance) {
          cb(err, instance);
        });
      }
    } else {
      return cb();
    }
  } catch (err) {
    return cb(err);
  }
};
