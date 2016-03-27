var when = require("when");
var request = require('request');

var BLUEPRINT_BASE_URL = "https://blueprint.demo.xively.com/api/v1/";


var getOrganizations = function(accountId, jwt) {
    return when.promise(function(resolve) {
        request.get({
          url: BLUEPRINT_BASE_URL+'organizations', 
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
    get: getOrganizations
};