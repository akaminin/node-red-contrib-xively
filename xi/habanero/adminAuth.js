// node-red security
// http://nodered.org/docs/security

var when = require("when");
var auth = require('./auth');

var habaneroSettings = require('./settings');


module.exports = {
   type: "credentials",
   users: function(username) {
       return when.promise(function(resolve) {
           // currently if you're logged in, we let you have full permission in red editor
           var user = { username: username, permissions: "*" };
           resolve(user);
       });
   },

   authenticate: function(username, password, accountId, appId, accessToken) {
     return when.promise(function(resolve) {
        auth.loginUser(username, password, process.env.XIVELY_ACCOUNT_ID).then(function(loginResp){
          if(loginResp === null){
            //error logging in
            resolve(null);
          }else{
            //login successfull
            var resolveLogin = function(){
              var user = { username: username, permissions: "*" };
              resolve(user);  
            };
            //resolveLogin();
            habaneroSettings.get().then(function(hSettings){
                if(hSettings == null){
                  auth.setupHabaneroAuth(loginResp["jwt"], accountId, appId, accessToken)
                  .then(resolveLogin)
                  .catch(function(err){
                    console.log("Unable to setup Xi Crednetials");
                    resolve(null);
                  });
                }else{
                  resolveLogin();
                }
            });  
          }
        });
     });
   },

   default: function() {
       return when.promise(function(resolve) {
           // Do not allow anonymous login
           resolve(null);
       });
   }
}