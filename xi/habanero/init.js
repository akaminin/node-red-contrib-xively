var when = require("when");
var auth = require("./auth");
var init = require("./init");

var redis = require('redis'),
    client = redis.createClient();

var HABANERO_CREDS_ID = "HABANERO_CREDS_ID";

var redisGetCredentialsId = function(){
    return when.promise(function(resolve, reject) {
        client.get(HABANERO_CREDS_ID, function(err, reply) {
            if (!err) {
                if (reply === null) {
                    return resolve(null);
                }
                return resolve(reply);
            }
            log.info("Redis ERROR: " + err);
            return resolve(null);
        });
    });
};

var redisSetCredentialsId = function(value){
    return when.promise(function(resolve, reject) {
        client.get(HABANERO_CREDS_ID, value, function(err, reply) {
            if (!err) {
                if (reply === null) {
                    return resolve(false);
                }
                return resolve(true);
            }
            log.info("Redis ERROR: " + err);
            return resolve(false);
        });
    });
};

var doLaHabanero = function(RED){
    // We are running as a habanero instance
    // need to make sure all is well

    // first need to make sure we have a user setup correctly
    var credentials = null;

    redisGetCredentialsId().then(function(habaneroUserCredsNodeId){
        if(!habaneroUserCredsNodeId){
            habaneroUserCredsNodeId = RED.util.generateId();
        }else{
            credentials = RED.nodes.getCredentials(habaneroUserCredsNodeId);
        }
        if(!credentials || !credentials.jwt){
            //we need to go create a habanero user
            RED.log.info("Creating Habanero IDM Xively User");
            auth.setupHabaneroAuth(
                process.env.XIVELY_ACCOUNT_ID, 
                process.env.XIVELY_APP_ID,
                process.env.XIVELY_ACCESS_TOKEN
            ).then(function(habaneroIdmUser){
                credentials = {};
                credentials.account_id = habaneroIdmUser.accountId;
                credentials.user_id = habaneroIdmUser.userId;
                credentials.username = habaneroIdmUser.username;
                credentials.password = habaneroIdmUser.password;
                credentials.jwt = habaneroIdmUser.jwt;
                RED.nodes.addCredentials(habaneroUserCredsNodeId, credentials);
                RED.log.info("Habanero idm user created with userId: "+credentials.user_id);
                //save creds node to DB
                return redisSetCredentialsId(habaneroUserCredsNodeId);
            }).catch(function(err){
                RED.log.error(err);
                RED.comms.publish(RED._("xively.errors.setupHabaneroAuth"));
            });
        }else{
            RED.log.info("Using existing credentials");
        } 
    });
};

module.exports = {
    Habanero: doLaHabanero
};