var when = require("when");
var redis = require('redis'),
    redisClient = redis.createClient();
redisClient.on("error", function (err) {
    console.log("Error " + err);
});


var adminAuth = require("./adminAuth");
var auth = require("./auth");
var init = require("./init");
var settings = require("./settings");



var isHabaneroInstance = function(){
    //always assume true until this package can be deployed independently
    return true;
};

module.exports = {
    //node-red adminAuth
    //http://nodered.org/docs/security
    adminAuth: adminAuth,
    //end adminAuth

    auth: auth,
    init: init.Habanero,
    isHabaneroInstance: isHabaneroInstance,
    settings: settings
}