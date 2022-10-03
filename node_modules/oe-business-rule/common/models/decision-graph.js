/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

var XLSX = require('xlsx');
var jsFeel = require('js-feel')();
var DL = jsFeel.decisionLogic;
var logger = require('oe-logger');
var log = logger('decision-graph');
var serialize = require('serialize-error');
var uuid = require('uuid');
var { createDecisionGraphAST, executeDecisionService } = jsFeel.decisionService;


module.exports = function (DecisionGraph) {
// Remote method to execute a Decision Service with data POSTed from the Rule Designer
  DecisionGraph.remoteMethod('execute', {
    description: 'Executes a Decision Service Payload Posted from the Rule Designer',
    accessType: 'WRITE',
    isStatic: true,
    accepts: [{ arg: 'inputData', type: 'object', http: { source: 'body' },
      required: true, description: 'The JSON containing the graph data and payload to execute' },
    {
      arg: 'options',
      type: 'object',
      http: 'optionsFromRequest'
    }
    ],
    http: {
      verb: 'POST',
      path: '/execute'
    },
    returns: {
      type: 'object',
      root: true
    }
  });

  // Executes a Decision Service with data POSTed from the Rule Designer
  DecisionGraph.execute = function (inputData, options, cb) {
    var decisionMap = inputData.jsonFeel;
    var decisions = inputData.decisions;
    var payload = inputData.payload;
    var guid = uuid();
    var ast = createDecisionGraphAST(decisionMap);
    // adding a random graph name - meant for app when in dev mode...
    var promises = decisions.map(d => executeDecisionService(ast, d, payload, guid));

    Promise.all(promises).then(answers => {
      cb(null, answers);
    }).catch(err => {
      log.error(err);
      cb(serialize(err), null);
    });
  };

  DecisionGraph.observe('before save', function DecisionGraphBeforeSaveFn(ctx, next) {
    var dataObj = ctx.instance || ctx.data;
    var { documentName, documentData } = dataObj;
    // if (!document) return next();
    if (!documentName) return next();
    var base64String = documentData.split(',')[1];
    // var binaryData = Buffer.from(base64String, 'base64').toString('binary');
    // var binaryData = new Buffer(base64String, 'base64').toString('binary');
    var workbook = XLSX.read(base64String, { type: 'base64' });
    try {
      var jsonFeel = DL.parseWorkbook(workbook);
      dataObj.data = jsonFeel;
      next();
    } catch (e) {
      log.error(ctx.options, 'Unable to process workbook data -', e);
      next(
        new Error(
          'Decision Graph workbook data could not be parsed. Please correct errors in the workbook.'
        )
      );
    }
  });

  DecisionGraph.remoteMethod('validate', {
    description: 'Validate the nodes of a decision graph from the Rule Designer',
    accessType: 'WRITE',
    isStatic: true,
    accepts: [{
      arg: 'inputData', type: 'object', http: { source: 'body' },
      required: true, description: 'The JSON containing the graph node data to validate'
    },
    {
      arg: 'options',
      type: 'object',
      http: 'optionsFromRequest'
    }
    ],
    http: {
      verb: 'POST',
      path: '/validate'
    },
    returns: {
      type: 'object',
      root: true
    }
  });

  // Validates the nodes with data POSTed from the Rule Designer
  DecisionGraph.validate = function validateDecisionGraph(inputData, options, cb) {
    var output = {};
    Object.keys(inputData).forEach(function (key) {
      var isValid = false;
      var message = null;
      try {
        jsFeel.feel.parse(inputData[key]);
        isValid = true;
      } catch (e) {
        message = {
          name: e.name,
          location: e.location
        };
      }
      output[key] = {
        valid: isValid,
        errormessage: message
      };
    });
    cb(null, output);
  };
};
