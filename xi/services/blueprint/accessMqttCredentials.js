var when = require("when");
var request = require('request');

var BLUEPRINT_BASE_URL = "https://blueprint.demo.xively.com/api/v1/";


var createMqttCredentials = function(accountId, jwt, entityType, entityId){
  return when.promise(function(resolve) {
        request.post({
          url: BLUEPRINT_BASE_URL+'access/mqtt-credentials', 
          headers: {
            Authorization: "Bearer "+ jwt
          },
          form:{
            accountId: accountId,
            entityId: entityId,
            entityType: entityType
          }
        },
        function(err,httpResponse,body){ 
          var resp = JSON.parse(body);
          resolve(resp);
        });
    });
}

module.exports = {
    create: createMqttCredentials
};