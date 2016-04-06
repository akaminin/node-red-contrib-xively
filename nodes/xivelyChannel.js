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

    var xiRed = require("../");
    var util = xiRed.habanero.util;

    var blueprint = require("../xi/services/blueprint");

    var mqtt = require("mqtt");

    function XivelyUserCredentialsNode (config) {
        RED.nodes.createNode(this, config);
        this.creds_name = config.creds_name;
    }

    RED.nodes.registerType("xively-user-credentials", XivelyUserCredentialsNode, {
        credentials: {
            creds_name: {type: "text"},
            account_id: {type: "text"},
            user_id: {type: "text"},
            account_user_id: {type: "text"},
            username: {type: "text"},
            password: {type: "password"}
        }
    });

    function OnWeekdaysFilterNode (config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.on('input', function (msg) {
            node.send(msg);
        });

        node.on("close", function() {
            // Called when the node is shutdown 
        });
    }

    RED.nodes.registerType("filter-on-weekdays", OnWeekdaysFilterNode);


    function XivelyChannelNode (config) {
        RED.nodes.createNode(this,config);

        this.xively_creds = config.xively_creds;
        this.device_template = config.device_template;
        this.device_channel = config.device_channel;
        this.payload_format = config.payload_format || "raw";

        var credentials = RED.nodes.getCredentials(this.xively_creds);

        var node = this;

        function onMqttMessage(topic, message){
            var payload = message.toString();

            if(node.payload_format == "json"){
                payload = util.format.tSDataToJSON(payload);
            }

            node.send({
                topic: topic,
                topicMeta: util.regex.topicToObject(topic),
                payload: payload
            });
        }

        function deviceSubscribe(device){
            device.channels.forEach(function(channelType){
                if(channelType.channelTemplateId == node.device_channel){
                    node.mqttClient.subscribe(channelType.channel, function(err, granted){
                        if(!err){
                            RED.log.debug("subscribed to: "+channelType.channel);
                        }else{
                            RED.log.error("error subscribing: "+err);
                        }
                    });
                }
            });
        }
        var jwtConfig;

        //begin by going and getting a JWT for idm user
        xiRed.habanero.auth.getJwtForCredentialsId(node.xively_creds).then(function(jwtResp){
            jwtConfig = jwtResp;
            //get mqtt creds for account-user
            return blueprint.accessMqttCredentials.create(
                jwtConfig.account_id, 
                jwtConfig.jwt,
                "accountUser",
                credentials.account_user_id
            );
        }).then(function(mqttCreateResp){
            //setup mqttClient
            node.mqttClient = mqtt.connect("mqtts://",{
                  host: "broker.demo.xively.com",
                  port: Number(8883),
                  username: credentials.account_user_id,
                  password: mqttCreateResp.mqttCredential.secret,
                  debug: true
            });

            node.mqttClient.on('connect', function () {
                RED.log.debug("mqttClient connected");
            });

            node.mqttClient.on('message', onMqttMessage);
            // end setup mqttClient

            //go get device list
            blueprint.devices.getByDeviceTemplateId(
                jwtConfig.account_id, 
                jwtConfig.jwt,
                node.device_template
            ).then(function(devicesResp){
                // subscribe for each device
                devicesResp.devices.results.forEach(function(device, index){
                    deviceSubscribe(device);
                });
            });
        }).catch(function(err){
            RED.log.error("Error setting up XivelyInNode: " + err);
        });

        node.on("close", function() {
            // Called when the node is shutdown 
            if(node.mqttClient){
                node.mqttClient.end(true);
            }
        });
    }

    RED.nodes.registerType("xively-channel", XivelyChannelNode);


    RED.httpAdmin.get('/xively/deviceTemplates/:id', RED.auth.needsPermission(""), function(req, res, next) {
        xiRed.habanero.auth.getJwtForCredentialsId(req.params.id).then(function(jwtConfig){
            blueprint.devicesTemplates.get(jwtConfig.account_id, jwtConfig.jwt).then(function(dTemplatesResp){
                res.json(dTemplatesResp.deviceTemplates.results);
            });
        }).catch(function(err){
            console.log(err);
            res.json([err]);
        });
    });

    RED.httpAdmin.get('/xively/orgs/:id', RED.auth.needsPermission(""), function(req, res, next) {
        xiRed.habanero.auth.getJwtForCredentialsId(req.params.id).then(function(jwtConfig){
            blueprint.organizations.get(jwtConfig.account_id, jwtConfig.jwt, req.query.parentId, req.query.page).then(function(dOrgsResp){
                res.json(dOrgsResp.organizations.results);
            });
        }).catch(function(err){
            console.log(err);
            res.json([err]);
        });
    });
}