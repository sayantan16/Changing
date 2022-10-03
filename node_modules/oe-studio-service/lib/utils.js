function _checkModelWithPlural(server, plural) {
  var models = server.models();
  var res = models.find(function (ele) {
    return (ele.clientPlural && ele.clientPlural === plural) || ele.pluralModelName === plural;
  });
  return res ? res.clientPlural ? res.clientModelName : res.modelName : null;
}

module.exports = {
  checkModelWithPlural: _checkModelWithPlural
};
