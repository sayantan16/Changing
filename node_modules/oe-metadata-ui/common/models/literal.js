/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
/**
 * @classdesc This model stores the literal translations for specified locale and group.
 * The model has following properties
 * Property |              Description
 * ---------|-------------------------------
 * `key`    | literal key
 * `value`  | translation value
 * `locale` | locale
 * `group`  | group name
 * `placeholders`  | system populated placeholders extracted from value
 *
 * A custom remote route Literals/render/en-US returns all records for
 * locale _en-US_ as hash-map (as opposed to array of records) where `key` becomes the hash-map key.
 * Following two records :
 * [
 *	{key: "total", "value": "Total"},
 *	{key: "username", "value": "User Name"}
 * ]
 *
 * are returned as
 * {
 *	"total": {
 *        "message": "Total"
 *    },
 *    "username": {
 *        "message": "User Name"
 *    }
 * }
 *
 * @kind class
 * @class Literal
 * @author Rohit Khode
 */

module.exports = function Literal(Literal) {
  Literal.observe('before save', populatePlaceholders);

  function populatePlaceholders(ctx, next) {
    var data = ctx.instance || ctx.currentInstance || ctx.data;

    var placeholders = {};
    if (data.placeholders && Array.isArray(data.placeholders)) {
      data.placeholders.forEach((phName, idx) => {
        placeholders[phName] = {
          content: '$' + (idx + 1)
        };
      });
      data.placeholders = placeholders;
    } else {
      var placeholderRegex = /\$\w+\$/g;
      var matches = data.value.match(placeholderRegex);
      if (matches) {
        matches.forEach((match, idx) => {
          placeholders[match.substr(1, match.length - 2)] = {
            content: '$' + (idx + 1)
          };
        });
        data.placeholders = placeholders;
      } else {
        delete data.placeholders;
      }
    }
    next();
  }

  function prepareAndSendData(data, cb) {
    var response = {};
    data.forEach(item => {
      if (!response[item.key]) {
        response[item.key] = {
          message: item.value,
          locale: item.locale,
          placeholders: item.placeholders
        };
      }
    });
    cb(null, response);
  }

  /**
   * Custom remote method to fetch set of Literals as hash-map.
   * @param  {string} locale - locale name
   * @param  {string} group - group name
   * @param  {object} options - callcontext options
   * @param  {function} cb - callback function
   */
  Literal.getLocaleData = function getLocaleData(locale, group, options, cb) {
    if (!cb && typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (locale && locale.endsWith('.json')) {
      locale = locale.substring(0, locale.length - 5);
    }

    var filter = {
      order: 'locale DESC',
      where: {
        locale: {
          inq: ['*']
        }
      }
    };
    if (locale && locale !== '*') {
      filter.where.locale.inq.push(locale);
    }
    if (group) {
      filter.where.group = group;
    }
    Literal.find(filter, options, function literalFindCb(err, data) {
      if (err) {
        return cb(err);
      }
      prepareAndSendData(data, cb);
    });
  };

  Literal.remoteMethod(
    'getLocaleData', {
      returns: [{
        type: 'object',
        root: true,
        description: 'return value'
      }],
      accepts: [{
        arg: 'locale',
        type: 'string',
        http: {
          source: 'path'
        }
      },
      {
        arg: 'group',
        type: 'string',
        http: {
          source: 'query'
        }
      },
      {
        arg: 'options',
        type: 'object',
        http: 'optionsFromRequest'
      }],
      http: {
        path: '/render/:locale',
        verb: 'get'
      }
    }
  );
};
