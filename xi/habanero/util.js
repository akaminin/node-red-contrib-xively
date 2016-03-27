
var topicRegEx = /xi\/blue\/v1\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/d\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/([0-9a-zA-Z_-]*)/i;

var tSDataToJSON = function(tsData){
    var lines = tsData.split("\n");
	var data = {};
	for(var i=0;i<lines.length;i++){
	    var parts = lines[i].split(",");
	    data[parts[1]] = {
	      "timestamp":parts[0],
	      "value":parts[2],
	      "other":parts[3]
	    };
	}
	return data;
}

var topicToObject = function(topicStr){
	var matches = topicStr.match(topicRegEx);
	if(matches === null){
		return null
	}
	return {
		accountId:matches[1],
		deviceId:matches[2],
		channelName:matches[3]
	}
}

module.exports = {
	regex: {
		topicToObject: topicToObject
	},
    format: {
    	tSDataToJSON: tSDataToJSON
    }
}