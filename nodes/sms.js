/**
 * Copyright 2016 LogMeIn Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// Xively Node-RED node file


module.exports = function(RED) {
    "use strict";
    // require any external libraries we may need....

    var request = require('request');
    var xiRed = require("../");
    var util = xiRed.habanero.util;

    var mustache = require("mustache");

    function XivelySmsCredentialsNode (config) {
        RED.nodes.createNode(this, config);
        this.creds_name = config.creds_name;
    }

    RED.nodes.registerType("xi-sms-credentials", XivelySmsCredentialsNode, {
        credentials: {
            creds_name: {type: "text"},
            api_key: {type: "password"}
        }
    });

    function XivelySmsOutNode (config) {
        RED.nodes.createNode(this,config);

        this.xi_sms_creds = config.xi_sms_creds;
        this.number = config.number;
        this.body = config.body;

        var credentials = RED.nodes.getCredentials(this.xi_sms_creds);

        var node = this;

        console.log(credentials.api_key);

        node.on('input', function (msg) {
            var renderedBody = mustache.render(node.body,msg);
            var urlEncodedBody = encodeURIComponent(renderedBody);
            var apiUrl = "https://api.sms.voxox.com/method/sendSms/key/"+credentials.api_key+"/to/"+node.number+"/body/"+urlEncodedBody;
            // request.get({url: apiUrl}, function(err,httpResponse,body){ 
            //   console.log("voxox resp: "+body);
            // });
        });

        node.on("close", function() {
            // Called when the node is shutdown 
        });
    }

    RED.nodes.registerType("xi-sms out", XivelySmsOutNode);
}