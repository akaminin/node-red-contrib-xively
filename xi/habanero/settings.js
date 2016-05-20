var when = require("when");
var redis = require('redis'),
    redisClient = redis.createClient({
        url: process.env.REDIS_URL
    });


var HABANERO_SETTINGS_KEY = "habanero_settings";


var getHabaneroSettings = function(){
    return when.promise(function(resolve, reject) {
        redisClient.get(HABANERO_SETTINGS_KEY, function(err, reply) {
            if (!err) {
                if (reply === null) {
                    return resolve(null);
                }
                return resolve(JSON.parse(reply));
            }
            log.info("Error initializing habanero_settings: " + err);
            return resolve(null);
        });
    });
}

var setHabaneroSettings = function(value){
    return when.promise(function(resolve, reject) {
        redisClient.set(HABANERO_SETTINGS_KEY, JSON.stringify(value), function(err, reply) {
            if (!err) {
                return resolve(true);
            }
            log.info("Redis ERROR: " + err);
            resolve(false);
        });
    });
}



module.exports = {
    get: getHabaneroSettings,
    set: setHabaneroSettings
}