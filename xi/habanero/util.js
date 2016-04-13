var topicRegEx = /xi\/blue\/v1\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/d\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/([0-9a-zA-Z_-]*)/i;

var tSDataToJSON = function(tsData){
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