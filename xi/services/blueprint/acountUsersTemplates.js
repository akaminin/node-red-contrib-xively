var when = require("when");
var request = require('request');

var BLUEPRINT_BASE_URL = "https://blueprint.xively.com/api/v1/";

var getAccountUsersTemplates = function(accountId, jwt) {
    return when.promise(function(resolve) {
        request.get({
          url: BLUEPRINT_BASE_URL+'account-users/templates', 
          headers: {
            Authorization: "Bearer "+ jwt
          },
          qs:{
            accountId: accountId
          }
        },
        function(err,httpResponse,body){ 
          var resp = JSON.parse(body);
          resolve(resp);
        });
  });
};

module.exports = {
    get: getAccountUsersTemplates
};