process.env.NODE_CONFIG_DIR = './node_modules/node-red-contrib-xively/config/';
var config = require('config');

function getApiRoot(configPath){
	var bpConfig = config.get(configPath);
	var apiBaseUrl = bpConfig.scheme + bpConfig.host;
	if(bpConfig.port && bpConfig.port !== 80){
		apiBaseUrl += ":"+bpConfig.port;
	}
	apiBaseUrl += bpConfig.apiRoot;
	return apiBaseUrl;
}


module.exports = {
	getApiRoot: getApiRoot
}