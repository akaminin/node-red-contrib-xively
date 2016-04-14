var when = require("when");

var blueprint = require("../services/blueprint");

var topicRegEx = /xi\/blue\/v1\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/d\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/([0-9a-zA-Z_-]*)/i;

var tSDataToJSON = function(tsData){
	// takes timeseries data and converts to object form
    var lines = tsData.split("\n");
	var data = {};
	for(var i=0;i<lines.length;i++){
	    var parts = lines[i].split(",");
	    var v, t;
	    if(!isNaN(parts[2])){
	    	v = parseFloat(parts[2]);
	    	t = "num";
	    }else{
	    	v = parts[3];
	    	t = "str";
	    }
	    data[parts[1]] = {
	      "timestamp":parts[0],
	      "value":v,
	      "type":t
	    };
	}
	return data;
}

var topicToObject = function(topicStr){
	// take a xively mqtt topic and extracts info to obejct form
	var matches = topicStr.match(topicRegEx);
	if(matches === null){
		return null
	}
	return {
		account:{id:matches[1]},
		device:{id:matches[2]},
		channel:{channelTemplateName:matches[3]}
	}
}

var ensureMsgHasDeviceInfo = function(jwt, msg){
	return when.promise(function(resolve, reject) {
		// quick and dirty way to see if we've already have retrieved device info
		if(msg.device.hasOwnProperty('created')){
			return resolve(msg);
		}
		try{
            var acctId = msg.account.id;
            var devId = msg.device.id;
            blueprint.devices.getDevice(acctId, jwt, devId).then(function(devResp){
                msg.device = devResp.device;
                resolve(msg);
            }).catch(function(err){
                throw err;
            });
        }catch(err){
            return reject(err);
        }
	});

}


module.exports = {
	regex: {
		topicToObject: topicToObject
	},
    format: {
    	tSDataToJSON: tSDataToJSON
    },
    ensureMsgHasDeviceInfo: ensureMsgHasDeviceInfo
}