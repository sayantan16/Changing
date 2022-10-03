/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

var XLSX = require('xlsx');
var jsFeel = require('js-feel')();
// var request = require('request');
var utils = require('loopback-datasource-juggler/lib/utils');
var assert = require('assert');
// var loopback = require('loopback');
var logger = require('oe-logger');
var log = logger('decision-table');
var { generateExcelBuffer } = require('../../lib/excel-helper');
var prefix = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,';

// var getError = require('oe-cloud/lib/error-utils').getValidationError;
var delimiter = '&SP';

const dTable = jsFeel.decisionTable;

module.exports = function decisionTableFn(decisionTable) {
  decisionTable.observe('before save', function decisionTableBeforeSave(ctx, next) {
    var data = ctx.__data || ctx.instance || ctx.data;
    if ('documentData' in data && typeof data.documentData !== 'undefined') {
      // parse the excel file, throw error if file invalid
      if (data.documentData.indexOf('base64') === -1) {
        return next(new Error('Decision table data provided is not a base64 encoded string'));
      }

      try {
        var base64String = data.documentData.split(',')[1];
        // var binaryData = Buffer.from(base64String, 'base64');
        // var workbook = XLSX.read(binaryData, { type: 'binary' });
        var workbook = XLSX.read(base64String, { type: 'base64' });

        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var csv = XLSX.utils.sheet_to_csv(sheet, { FS: delimiter });
        var decisionRules = dTable.csv_to_decision_table(csv);
        data.decisionRules = JSON.stringify(decisionRules);
        next();
      } catch (err) {
        log.error(ctx.options, 'Error - Unable to process decision table data -', err);
        next(new Error('Decision table data provided could not be parsed, please provide proper data'));
      }
    } else if ('decisionRules' in data) {
      next();
    } else {
      next(new Error('Data being posted is incorrect. Either an excel file was expected for property - documentData, or, a parsed decision table object was expected for property - decisionRules'));
    }
  });

  decisionTable.remoteMethod('exec', {
    description: 'execute a business rule',
    accessType: 'WRITE',
    accepts: [
      {
        arg: 'documentName',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        },
        description: 'Name of the Document to be fetched from db for rule engine'
      },
      {
        arg: 'data',
        type: 'object',
        required: true,
        http: {
          source: 'body'
        },
        description: 'An object on which business rules should be applied'
      },
      {
        arg: 'options',
        type: 'object',
        http: 'optionsFromRequest'
      }
    ],
    http: {
      verb: 'post',
      path: '/exec/:documentName'
    },
    returns: {
      arg: 'data',
      type: 'object',
      root: true
    }
  });

  decisionTable.exec = function decisionTableExec(
    documentName,
    data,
    options,
    callback
  ) {
    // var businessRuleEngine = 'evBusinessRule';
    if (typeof callback === 'undefined') {
      if (typeof options === 'function') {
        // execrule (documentName, data, callback)
        callback = options;
        options = {};
      }
    }

    data = data || {};
    options = options || {};
    callback = callback || utils.createPromiseCallback();

    assert(
      typeof documentName === 'string',
      'The documentName argument must be string'
    );
    assert(
      typeof data === 'object',
      'The data argument must be an object or array'
    );
    assert(
      typeof options === 'object',
      'The options argument must be an object'
    );
    assert(
      typeof callback === 'function',
      'The callback argument must be a function'
    );

    decisionTable.find(
      {
        where: {
          name: documentName
        }
      },
      options,
      function decisionTableFind(err, decisionTableData) {
        if (err) {
          callback(err);
        } else if (decisionTableData.length) {
          var docId = decisionTableData[0].id + decisionTableData[0]._version;
          var rules = JSON.parse(decisionTableData[0].decisionRules);
          dTable.execute_decision_table(docId, rules, data, function (err, results) {
            if (err) {
              callback(err);
            } else {
              callback(null, results);
            }
          });
        } else {
          var err1 = new Error(
            'No Document found for DocumentName ' + documentName
          );
          err1.retriable = false;
          callback(err1);
        }
      }
    );
  };

  decisionTable.document = function getDocument(recordId, options, cb) {
    if (typeof cb === 'undefined' && typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof recordId === 'undefined') {
      return cb(new Error('"id" is a required parameter'));
    }

    options = options || {};
    cb = cb || utils.createPromiseCallback();

    decisionTable.findOne({ where: { id: recordId } }, options, function dtFineOneCb(err, result) {
      if (err) {
        return cb(err);
      }

      var { documentData, documentName } = result;

      return cb(null, { name: documentName, data: documentData });
    });
  };

  const getFormattedValue = str => str.replace(/\"{2,}/g, '\"').replace(/^\"|\"$/g, '');

  function parseContext(commaSepString) {
    const csv = commaSepString.split('\n');
    let context = {};
    let i = 1;

    for (; i < csv.length; i += 1) {
      const arr = csv[i].split(delimiter).filter(String);
      if (arr.length > 0 && arr[0] === 'RuleTable') {
        break;
      } else if (arr.length > 0) {
        const count = arr[1].split('"').length - 1;
        if (count > 0) {
          arr[1] = getFormattedValue(arr[1]);
        }
        context[arr[0]] = arr[1];
      }
    }
    // context = Object.keys(context).length > 0 ? JSON.stringify(context).replace(/"/g, '').replace(/\\/g, '"') : '';
    // return context.length > 0 ? context : null;
    return context;
  }

  decisionTable.remoteMethod('document', {
    description: 'retrieve the excel file document of the corresponding decision (as base64 only)',
    accessType: 'READ',
    accepts: [
      {
        arg: 'id',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        },
        description: 'record id of the corresponding decision or rule name'
      },
      {
        arg: 'options',
        type: 'object',
        http: 'optionsFromRequest'
      }
    ],
    http: {
      verb: 'get',
      path: '/:id/document'
    },
    returns: {
      arg: 'data',
      type: 'object',
      root: true
    }
  });

  decisionTable.remoteMethod('parseExcel', {
    description: 'Parse the uploaded excel and return valid decision table',
    accessType: 'WRITE',
    isStatic: true,
    accepts: [{
      arg: 'inputData', type: 'object', http: { source: 'body' },
      required: true, description: 'The JSON containing the document data to parse'
    },
    {
      arg: 'options',
      type: 'object',
      http: 'optionsFromRequest'
    }
    ],
    http: {
      verb: 'POST',
      path: '/parseExcel'
    },
    returns: {
      type: 'object',
      root: true
    }
  });

  // Parses the excel uploaded from the feel designer
  decisionTable.parseExcel = function (inputData, options, cb) {
    var document = inputData;
    if (
      typeof document.documentData !== 'string' ||
      document.documentData.indexOf('base64') < 0
    ) {
      return cb(
        new Error(
          'Decision table data provided is not a base64 encoded string'
        )
      );
    }
    var base64String = document.documentData.split(',')[1];
    var binaryData = new Buffer(base64String, 'base64').toString(
      'binary'
    );
    var workbook = XLSX.read(binaryData, {
      type: 'binary'
    });

    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    var csv = XLSX.utils.sheet_to_csv(sheet, { FS: delimiter });
    var decisionRules = dTable.csv_to_decision_table(csv);
    var contextObj = parseContext(csv);
    cb(null, { decisionRules, contextObj });
  };


  // remote method declaration for getExcel
  decisionTable.remoteMethod('getExcel', {
    description: 'Generates an excel file response, given a json description for a decision table from the rule designer',
    accessType: 'WRITE',
    isStatic: true,
    accepts: [
      {
        arg: 'dtJson',
        type: 'object',
        http: { source: 'body' },
        required: true,
        description: 'The JSON containing the decision table description from rule designer'
      }
    ],
    http: {
      verb: 'POST',
      path: '/getExcel'
    },
    returns: [
      {
        type: 'string',
        root: true,
        arg: 'body',
        description: 'base64 encoded string which encodes the generated excel file'
      }
    ]
  });

  decisionTable.getExcel = function (dtJson, options, cb) {
    if (typeof cb === 'undefined' && typeof options === 'function') {
      cb = options;
      options = {};
    }
    try {
      let buff = generateExcelBuffer(dtJson);
      let base64Data = prefix + buff.toString('base64');
      cb(null, base64Data);
    } catch (error) {
      cb(error);
    }
  };
};
