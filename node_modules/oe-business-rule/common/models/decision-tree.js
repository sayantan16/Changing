/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

var logger = require('oe-logger');
var assert = require('assert');
var log = logger('decision-tree');
var loopback = require('loopback');
const vm = require('vm');

module.exports = function (decisionTree) {
  decisionTree.observe('before save', function decisionTreeBeforeSave(ctx, next) {
    var data = ctx.__data || ctx.instance || ctx.data;
    try {
      var decisionTreeConnectionArray = data.connections;
      var rootNodeArray = decisionTreeConnectionArray.filter((cxn, idx) => {
        let isJoined = decisionTreeConnectionArray.some((cxn2, id) => {
          if (idx === id) {
            return false;
          }
          return cxn2.to === cxn.from;
        });
        return !isJoined;
      });

      if (rootNodeArray.length > 1) {
        next(new Error('Decision tree should not have more than one root node'));
      }
      if (rootNodeArray[0].from === '' || rootNodeArray[0].from === null) {
        next(new Error('Decision tree root node should not be empty or null'));
      }
      if (rootNodeArray.length > 0) {
        data.rootNodeId = rootNodeArray[0].from;
      }
      next();
    } catch (err) {
      log.error(ctx.options, 'Error - Unable to process decision tree data -', err);
      next(new Error('Decision tree data provided could not be parsed, please provide proper data'));
    }
  });

  decisionTree.remoteMethod('exec', {
    description: 'execute a business rule',
    accessType: 'WRITE',
    accepts: [
      {
        arg: 'name',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        },
        description: 'Name of the Decision Tree to be fetched from db for rule engine'
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
      path: '/exec/:name'
    },
    returns: {
      arg: 'data',
      type: 'object',
      root: true
    }
  });

  decisionTree.exec = function decisionTreeExec(
    name,
    data,
    options,
    callback
  ) {
    if (typeof callback === 'undefined') {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
    }

    data = data || {};
    options = options || {};

    assert(
      typeof name === 'string',
      'The decision tree name argument must be string'
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

    decisionTree.find(
      {
        where: {
          name: name
        }
      },
      options,
      function decisionTreeFind(err, decisionTreeData) {
        if (err) {
          callback(err);
        } else if (decisionTreeData.length) {
          var rootId = '';
          var nodes = [];
          var connections = [];

          rootId = decisionTreeData[0].rootNodeId;
          if (decisionTreeData[0].nodes.length > 0) {
            nodes = decisionTreeData[0].nodes;
          }
          if (decisionTreeData[0].connections.length > 0) {
            connections = decisionTreeData[0].connections;
          }
          if (nodes.length > 0) {
            traverseDecisionTree(rootId, nodes, connections, data, {}, options, callback);
          }
        } else {
          var err1 = new Error(
            'No Tree found for TreeName ' + name
          );
          err1.retriable = false;
          callback(err1);
        }
      }
    );
  };

  function traverseDecisionTree(rootId, nodes, connections, payload, result, options, done) {
    try {
      var updatedPayload = {};
      var curnode = nodes.find(function (node) {
        return node.id === rootId;
      });
      var filteredConnections = connections.filter(function (connection) {
        return connection.from === rootId;
      });
      var rootName = curnode.name;
      if (curnode.nodeType !== 'DECISION_TABLE') {
        if (filteredConnections.length > 0) {
          traverseDecisionTreeUtil(nodes, filteredConnections, connections, payload, result, options, done);
        } else {
          return done(null, result);
        }
      } else if (curnode.nodeType === 'DECISION_TABLE') {
        var DecisionTreeModel = loopback.getModel('DecisionTable', options);
        DecisionTreeModel.exec(rootName, payload, options, function (err, res) {
          if (err) {
            log.error(options, err.message);
          }
          updatedPayload = Object.assign(payload, res);
          result = Object.assign(result, res);
          if (filteredConnections.length > 0) {
            traverseDecisionTreeUtil(nodes, filteredConnections, connections, updatedPayload, result, options, done);
          } else {
            return done(null, result);
          }
        });
      }
    } catch (error) {
      log.error(error);
    }
  }

  function traverseDecisionTreeUtil(nodes, currrentNodeConnections, connections, payload, result, options, done) {
    var node = currrentNodeConnections.find(function (node) {
      if (node.condition === '' || node.condition === null) {
        return true;
      }

      return !!evaluateCondition(payload, node.condition);
    });
    return traverseDecisionTree(node.to, nodes, connections, payload, result, options, done);
  }

  function evaluateCondition(payload, condition) {
    // eslint-disable-next-line
    var context = new vm.createContext(payload);
    var compiledScript = new vm.Script('this.output = (' + condition + ');');
    compiledScript.runInContext(context);
    return context.output;
  }
};
