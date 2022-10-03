var loopback = require('loopback');
var async = require('async');

module.exports = EnrichmentRuleBootFactory;

function EnrichmentRuleBootFactory(EnrichmentRule, app) {
  var DecisionService = app.models.DecisionService;
  var DecisionTable = app.models.DecisionTable;

  var isHookAttached = model => {
    var beforeSaveObserversArray = model._observers['before save'];
    var hookFnName = `bound ${helper.enrichData.name}`;
    // ^ why? -> https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name
    return beforeSaveObserversArray && beforeSaveObserversArray.some(observer => observer.name === hookFnName);
  };

  var helper = {

    enrichData(ctx, next) {
      var model = this;
      // ^ because we have already fixed context
      // var data = ctx.instance || ctx.data;
      // var payload = data.__data || data;
      var payload = null;
      if (ctx.currentInstance) {
        payload = Object.assign({}, ctx.currentInstance.__data, ctx.data);
      } else {
        var data = ctx.instance || ctx.data;
        payload = data.__data || data;
      }
      var filter = { where: { modelName: model.modelName, disabled: false } };
      EnrichmentRule.findOne(filter, ctx.options, (err, enrichmentRuleRecord) => {
        if (err) {
          next(err);
        } else if (enrichmentRuleRecord) {
          payload.options = ctx.options;
          payload.options.modelName = model.modelName;
          var { rules, isService } = enrichmentRuleRecord;
          var populatorTasks = rules.map(rule => cb => {
            if (isService) {
              DecisionService.invoke(rule, payload, ctx.optins, (err, results) => {
                // CONVENTION: the result received from a decision service invocation is an
                // object. The properties represent nodes in the decision graph taking part in
                // the decision. We assume that the corresponding value (which is always an object)
                // are what enriches the payload
                Object.keys(results || {})
                  .forEach(decisionName => {
                    var decisionValue = results[decisionName];
                    if (typeof decisionValue === 'object') {
                      Object.keys(decisionValue).forEach(enrichedKey => {
                        payload[enrichedKey] = decisionValue[enrichedKey];
                      });
                    }
                  });
                // done with forEach
                cb(err);
              });
              // end of isService block
            } else {
              DecisionTable.exec(rule, payload, ctx.options, (err, result) => {
                if (err) {
                  cb(err);
                } else {
                  if (result) {
                    Object.keys(result).forEach(key => {
                      payload[key] = result[key];
                    });
                  }
                  delete payload.options;
                  cb();
                }
              });
            }
            // end of if-else isService block
          });
          async.seq(...populatorTasks)(err => {
            ctx.data = ctx.instance = payload;
            next(err);
          });
        } else {
          next();
        }
      });
    },

    validateEntry(ctx, next) {
      var data = ctx.data || ctx.instance;
      // It is good to have if we have a declarative way of validating model existence.
      var modelName = data.modelName;
      var model = loopback.findModel(modelName, ctx.options);
      if (model) {
        next();
      } else {
        next(new Error(`Cannot attach enrichment rule to non-existent model: ${modelName}`));
      }
    },

    attachEnrichmentHooksToEntry(ctx, next) {
      var data = ctx.data || ctx.instance;
      var { modelName } = data;
      var model = loopback.findModel(modelName, ctx.options);
      model.settings._isModelRuleExists = true;

      if (!isHookAttached(model)) {
        model.observe('before save', helper.enrichData.bind(model));
      }

      next();
    }
  };

  return helper;
}
