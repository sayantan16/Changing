/**
 *
 * �2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

// Author : Atul
const async = require('async');
const util = require('./util');
const log = require('oe-logger')('Implicit-Composite');

function createBelongsToRecords(childModel, data, self, payload, options, cb) {
  var keyTo = self[payload.relationName].keyTo;
  var keyFrom = self[payload.relationName].keyFrom;
  // Check with Atul about the purpose of this assignment
  options[payload.relationName] = payload.data;

  // Making object into an array
  if (Array.isArray(payload.data)) {
    log.warn('Found Array - Expecting Object for BelongsTo Child Data. Treating as Object');
    payload.data = payload.data[0];
  }
  // var recs = Array.isArray(payload.data) === false ? [payload.data] : payload.data;
  var childRow = payload.data;
  var createOrModify = (payload.action === 'post') ? 'create' : 'updateOrCreate';
  childModel[createOrModify](childRow, options, function (err, createdRecord) {
    if (err) {
      return cb(err);
    }
    var childModelData = createdRecord.__data;
    data[keyFrom] = childModelData[keyTo];
    return cb(err, payload.relationName);
  });

  /*
  async.eachSeries(recs, function (cr, done) {
    childModel[createOrModify](cr, options, function (err, createdRecord) {
      if (err) {
        return done(err);
      }
      var childModelData = createdRecord.__data;
      //if (!data[keyFrom]) {
        //data[keyFrom] = [];
      //}
      //data[keyFrom].push(childModelData[keyTo]);
      data[keyFrom] = childModelData[keyTo];
      done();
    });
  }, function (err) {
    if (!err) {
      deleteRelations.push(payload.relationName);
    }
    return cb(err, deleteRelations);
  });
  */
}


function executeImplicitComposite(self, action, data, childData, relations, options, cb) {
  options.skipIdempotent = true;

  function createChildModelRecord(parentData, childModelName, cr, options, childRecCb) {
    try {
      var childModelCreate = util.getChildModelCreateFunc(parentData, childModelName, cr);
      childModelCreate.func(childModelCreate.payload, options, function (err1, childRecord) {
        return childRecCb(err1, childRecord);
      });
    } catch (exErr) {
      return childRecCb(exErr);
    }
  }

  var responseData = {};
  function addRelationDataToResponse(recInst, rltns, relationName, cb) {
    if (rltns[relationName].type === 'hasOne') {
      responseData.__data[relationName] = recInst;
    } else {
      if (!responseData.__data[relationName]) {
        responseData.__data[relationName] = [];
      }
      responseData.__data[relationName].push(recInst);
    }
    cb();
  }

  try {
    // CreateOrUpdate Parent Model Record
    var operation;
    if (action.toLowerCase() === 'post') {
      operation = 'create';
    } else if (action.toLowerCase() === 'put') {
      operation = 'updateOrCreate';
    } else if (action.toLowerCase() === 'putbyid') {
      operation = 'updateAttributes';
    }

    // var operation = (action === 'create') ? 'create' : ((action === 'put') ? 'updateOrCreate' : 'updateAttributes');
    var realSelf = self;

    if (operation === 'updateAttributes') {
      /* eslint-disable new-cap */
      // realSelf = new self(data);
      if (self.constructor.name !== 'Function') {self = self.constructor;} else {realSelf = new self(data);}
      /* eslint-enable new-cap */
    }
    var errorFlag = false;
    var relName;
    Object.keys(childData).forEach(function (relationName) {
      var childRows = childData[relationName];
      relName = relationName;
      if (self.relations[relationName].type === 'hasOne' && Array.isArray(childRows) && childRows.length > 1) {
        errorFlag = true;
      }
    });
    if (errorFlag) {
      return cb(new Error('hasOne relation - ' + relName + ' - should not contain more than one data'));
    }

    realSelf[operation](data, options, function respHndlr(err, createdRecord) {
      if (err) {
        return cb(err, createdRecord);
      }
      responseData = createdRecord;
      // Iterate All Relation Models Record
      async.forEachOfSeries(childData, function oneRltnHndlr(childRows, relationName, done) {
        // var relatedModel = relations[relationName];
        // var realSelf = (action === 'putbyid') ? self.constructor : self;
        // var childModel = realSelf.dataSource.modelBuilder.models[relatedModel];
        var childModel = self.relations[relationName].modelTo;
        var keyTo = self.relations[relationName].keyTo;
        var keyFrom = self.relations[relationName].keyFrom;

        if (self.relations[relationName].type === 'hasOne' && !Array.isArray(childRows)) {
          childRows = [childRows];
        }
        // CreateOrUpdate Single Relation Model Record and Process its recs one by one
        async.eachSeries(childRows, function oneRecHndlr(cr, done2) {
          cr[keyTo] = createdRecord[keyFrom];
          var parentData = { inst: createdRecord, relationName: relationName };
          if (self.settings.relations[relationName].through) {
            parentData.hasManyThrough = self.settings.relations[relationName].through;
          }
          if (action === 'post') {
            createChildModelRecord(parentData, childModel, cr, options, function (err1, childRecord) {
              if (err1) {
                return done2(err1);
              }
              addRelationDataToResponse(childRecord, self.relations, relationName, done2);
            });
          } else {
            // updateChildModel based on row_status('added','modified','deleted')
            var pk = util.getIdFields(childModel);
            util.applyRecord(parentData, childModel, pk, options, cr, function (err2, childRecord) {
              if (err2) {
                return done2(err2);
              }
              if (!childRecord) {
                return done2();
              }
              addRelationDataToResponse(childRecord, self.relations, relationName, done2);
            });
          }
        }, function (err) {
          return done(err);
        }
        );
      }, function (err) {
        return cb(err, responseData);
      }
      );
    });
  } catch (exErr) {
    return cb(exErr);
  }
}

module.exports.execute = function implicitComposite(self, action, data, childData, relations, options, cb) {
  var dataToDelete = [];
  options.childData = childData;
  async.forEachOfSeries(childData, function (childRows, relationName, done) {
    // var realSelf = (action === 'putbyid') ? self.constructor.relations : self.relations;
    var realSelf = self.relations || self.constructor.relations;
    if (realSelf[relationName].type === 'belongsTo') {
      var payload = {
        data: childRows, action: action,
        relationName: relationName, relatedModelName: relations[relationName]
      };
      var childModel = self.constructor.dataSource ? self.constructor.dataSource.modelBuilder.models[payload.relatedModelName] : self.dataSource.modelBuilder.models[payload.relatedModelName];
      createBelongsToRecords(childModel, data, realSelf, payload, options, function (err, relationToDelete) {
        if (err) {
          return done(err);
        }
        dataToDelete.push(relationToDelete);
        done();
      });
    } else {
      done();
    }
  }, function (err) {
    if (err) {
      cb(err);
    } else {
      dataToDelete.forEach(r => {
        delete childData[r];
        delete relations[r];
      });
      executeImplicitComposite(self, action, data, childData, relations, options, cb);
    }
  });
};
