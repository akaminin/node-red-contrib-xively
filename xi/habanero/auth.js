var when = require("when");
var request = require('request');
var uuid = require('node-uuid');
var redis = require('redis'),
    redisClient = redis.createClient();

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

var idm = require('../services/idm');
var blueprint = require('../services/blueprint');
var habaneroSettings = require('./settings');

var RED = require("../../../../red/runtime");


var createHabaneroIdmUser = function(xiAccountId, xiAppId, xiAccessToken){
    return when.promise(function(resolve, reject) {
        var loop = 0;
        var pw = uuid.v4();
        var email = null;

        function createUser(){
            email = "habanero_"+loop+"@"+xiAccountId+".com";
            return idm.auth.createUser(email, pw, xiAccountId, xiAppId, xiAccessToken).then(function(resp){
                if(resp['emailAddress'] === email){
                    resolve({email:email, password:pw, userId:resp["userId"]});
                }else{
                    loop++;
                    if(loop>75){
                        return reject("too many habanero users");
                    }
                    return createUser();
                }
            });
        }
        createUser().then(resolve);
    });
};

var setupDefaultFlows = function(habaneroIdmUser){
    return when.promise(function(resolve, reject) {
        var credsId = RED.util.generateId();
        var defaultFlows = require('./defaultFlows/exampleFlows.json');
        var flows = [];
        defaultFlows.forEach(function(node, index, array){
            if(node.type == "xively-user-credentials"){
                node.id = credsId;
            }else if(node.hasOwnProperty("xively_creds")){
                node.xively_creds = credsId;
            }
            flows.push(node);
        });
        RED.nodes.addCredentials(credsId, habaneroIdmUser);
        RED.nodes.setFlows(flows, "full");
        habaneroSettings.set({credsId:credsId}).then(function(settingsSaved){
            resolve();
        });
    });
};


var setupHabaneroAuth = function(jwt, xiAccountId, xiAppId, xiAccessToken){
    var habaneroIdmUserCreds;
    return when.promise(function(resolve, reject) {
        createHabaneroIdmUser(xiAccountId, xiAppId, xiAccessToken).then(function(idmUser){
            habaneroIdmUserCreds = {
                creds_name: "HabaneroUser",
                account_id: xiAccountId,
                user_id: idmUser.userId,
                username: idmUser.email,
                password: idmUser.password
            };
            return blueprint.accountUsers.post(xiAccountId, jwt);
        }).then(function(createAccountUserResp){
            habaneroIdmUserCreds.account_user_id = createAccountUserResp.accountUser.id;
            return setupDefaultFlows(habaneroIdmUserCreds);
        }).then(function(){
            return resolve(habaneroIdmUserCreds);
        }).catch(function(err){
            console.log("setupXiAuth err: "+err);
            reject(err);
        });
    });
};

var loginUser = function(username, password, accountId){
    return idm.auth.loginUser(username, password, accountId);
};

module.exports = {
    loginUser:loginUser,
    setupHabaneroAuth: setupHabaneroAuth
};