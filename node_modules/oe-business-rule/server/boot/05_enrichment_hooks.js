// var async = require('async');
var loopback = require('loopback');
var init = require('../../lib/enrichment-helpers');
function noop() { }
const logger = require('oe-logger');
const log = logger('rule-enrichment');

module.exports = function EnrichmentHooks(app, cb) {
  log.info('Initializing for rule enrichment');
  var EnrichmentRule = loopback.findModel('EnrichmentRule');

  var { validateEntry, attachEnrichmentHooksToEntry } = init(EnrichmentRule, app);
  // 1. on before save - ensure the EnrichmentRule record
  // is valid
  EnrichmentRule.observe('before save', validateEntry);
  // 2. on after save - attach hooks to the target model
  // that does the property population
  EnrichmentRule.observe('after save', attachEnrichmentHooksToEntry);

  // 3. iterate through all models in EnrichmentRule
  // and attach the enrichment hooks to those models
  // (since they would not be set on boot normally)
  var filter = {
    where: {
      disabled: false
    }
  };

  EnrichmentRule.find(filter, {}, (err, records) => {
    if (err) {
      cb(err);
    } else {
      var fakeContext = { options: {} };

      records.every(enrichmentRule => {
        var { modelName } = enrichmentRule;
        var model = loopback.findModel(modelName);
        if (model) {
          // model.observe('before save', enrichData.bind(model));
          fakeContext.instance = enrichmentRule;
          attachEnrichmentHooksToEntry(fakeContext, noop);
          return true;
        }

        cb(new Error(`The model "${modelName}" could not be found`));
        return false;
      });
      cb();
    }
  });
};
