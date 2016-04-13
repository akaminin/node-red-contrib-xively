var when = require("when");
var request = require('request');

var getApiRoot = require('../util').getApiRoot;
var TIMESERIES_BASE_URL = getApiRoot('xively.services.timeseries');

var getActivityStream= function(accountId, jwt, userId) {
    return when.promise(function(resolve) {
    	var url = TIMESERIES_BASE_URL + topic + '/latest';
        request.get({
          url: url, 
          headers: {
            Authorization: "Bearer "+ jwt
          },
          qs:{
            accountId: accountId,
            userId: userId

          }
        },
        function(err,httpResponse,body){ 
          var resp = JSON.parse(body);
          resolve(resp);
        });
  });
};

