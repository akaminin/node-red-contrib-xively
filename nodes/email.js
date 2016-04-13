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

// Xively Node-RED Email node file


module.exports = function(RED) {
    "use strict";
    // require any external libraries we may need....
    var request = require('request');
    var mustache = require('mustache');

    var xiRed = require('../');
    var util = require("../xi/services/util");
    var blueprint = require("../xi/services/blueprint");

    var SEND_EMAIL_POST_URL = util.getApiRoot('xively.habanero-proxy')+'email';

    function XivelyEmailOutNode (config) {
        RED.nodes.createNode(this,config);

        this.xively_creds = config.xively_creds;
        this.email_input_type = config.email_input_type;
        this.email = config.email;
        this.property = config.property;
        this.propertyType = config.propertyType || "msg";
        this.subject = config.subject;
        this.body = config.body;
        this.include_device_data = config.include_device_data;

        var node = this;

        function sendEmail(jwt, toAddress, subject, body){
            request.post({
                    url: SEND_EMAIL_POST_URL,
                    headers: {
                        Authorization: 'Bearer ' + jwt
                    },
                    form:{
                        to: toAddress,
                        subject: subject,
                        body: body
                    }
                }, 
                function(err,httpResponse,body){ 
                    if(!err){
                        RED.log.debug('send email resp: ' + body);
                    }else{
                        RED.log.debug('error sending email: ' + err);
                    }
                }
            );
        }

        node.on('input', function (msg) {
            var renderedSubject = mustache.render(node.subject, msg);
            var renderedBody = mustache.render(node.body, msg);
            var toAddress = node.email;
            if(node.email_input_type === "property"){
                toAddress = RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg);
            }

            xiRed.habanero.auth.getJwtForCredentialsId(node.xively_creds).then(function(jwtResp){
                var jwt = jwtResp.jwt;
                if(node.include_device_data){
                    // try to include device info based on topic
                    try{
                        var acctId = msg.topicMeta.accountId;
                        var devId = msg.topicMeta.deviceId;
                        blueprint.devices.getDevice(acctId, jwt, devId).then(function(devResp){
                            var deviceInfo = devResp.device;
                            // dont need to display channel info
                            delete deviceInfo["channels"];
                            renderedBody += "\r\n\r\n";
                            renderedBody += JSON.stringify(deviceInfo, null, 2);
                            sendEmail(jwt, toAddress, renderedSubject, renderedBody);
                        }).catch(function(err){
                            throw err;
                        });
                    }catch(err){
                        RED.log.warn("Unable to capture device info for email: "+err);
                        sendEmail(jwt, toAddress, renderedSubject, renderedBody);
                    }
                }else{
                    sendEmail(jwt, toAddress, renderedSubject, renderedBody);
                }
            });
            
        });
    }

    RED.nodes.registerType('xi-email out', XivelyEmailOutNode);
}