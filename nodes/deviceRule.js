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

    var merge = require("merge");

    var operators = {
        'eq': function(a, b) { return a == b; },
        'neq': function(a, b) { return a != b; },
        'lt': function(a, b) { return a < b; },
        'lte': function(a, b) { return a <= b; },
        'gt': function(a, b) { return a > b; },
        'gte': function(a, b) { return a >= b; },
        'btwn': function(a, b, c) { return a >= b && a <= c; },
        'cont': function(a, b) { return (a + "").indexOf(b) != -1; },
        'regex': function(a, b, c, d) { return (a + "").match(new RegExp(b,d?'i':'')); },
        'true': function(a) { return a === true; },
        'false': function(a) { return a === false; },
        'null': function(a) { return (typeof a == "undefined" || a === null); },
        'nnull': function(a) { return (typeof a != "undefined" && a !== null); },
        'else': function(a) { return a === true; }
    };

    var xiRed = require("../");
    var getJwt = xiRed.habanero.auth.getJwtForCredentialsId;
    var util = xiRed.habanero.util;

    var blueprint = require("../xi/services/blueprint");
    var timeseries = require("../xi/services/timeseries");

    var mqtt = require("mqtt");


    function XivelyDeviceRuleNode (config) {
        RED.nodes.createNode(this,config);

        this.xively_creds = config.xively_creds;
        this.rules = config.rules || [];
        this.device_template = config.device_template;
        this.device_channel = config.device_channel;
        this.matchall = config.matchall || true;
        this.matchall = (this.matchall === "false") ? false : true;

        var credentials = RED.nodes.getCredentials(this.xively_creds);

        var node = this;

        // parse values from rules 
        for (var i=0; i<this.rules.length; i+=1) {
            var rule = this.rules[i];

            if(i==0){
                if(rule.it !== 'channel'){
                    throw "First rule must have a channel input";
                }
                node.device_channel = rule.iv;
            }

            if (!rule.vt) {
                rule.vt = 'str';
            }
            if (rule.vt === 'str' || rule.vt === 'num') {
                if (!isNaN(Number(rule.v))) {
                    rule.v = Number(rule.v);
                }
            }

            if (typeof rule.v2 !== 'undefined') {
                if (!rule.v2t) {
                    rule.v2t = 'str';
                }
                if (rule.v2t === 'str' || rule.v2t === 'num') {
                    if (!isNaN(Number(rule.v2))) {
                        rule.v2 = Number(rule.v2);
                    }
                }
            }
        }


        function onMqttMessage(topic, message){
            var payload = message.toString();

            payload = util.format.tSDataToJSON(payload);

            var msg = merge(
                {topic: topic, payload: payload},
                util.regex.topicToObject(topic)
            );

            evaluateRules(msg);
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

        function evaluateRules(msg){
            try {
                for (var i=0; i<node.rules.length; i+=1) {
                    var rule = node.rules[i];
                    var prop;
                    var defaultChannel;
                    if(rule.it == 'channel'){
                        if(i==0 || defaultChannel === rule.iv){
                            if(i==0){
                                defaultChannel = rule.iv;
                            }
                            if(rule.sv == "value"){
                                var cKeys = Object.keys(msg.payload);
                                if(cKeys.length > 1){
                                    RED.log.warn("Input set to value, but channel has multiple values.");   
                                }
                                // grab first value
                                prop = msg.payload[cKeys[0]].value;

                            }else{
                                try{
                                    prop = RED.util.evaluateNodeProperty('payload.'+rule.sv,'msg',node,msg);
                                }catch(err){
                                    RED.log.info("Unable to evaluate input value for rule: "+err);
                                    break;
                                }
                            }
                        }else{
                            
                            var otherTopic = 'xi/blue/v1/'+msg.account.id+'/d/'+msg.device.id+'/'+rule.iv;
                            console.log(otherTopic);
                            getJwt(node.xively_creds).then(function(jwtConfig){
                                timeseries.getLatestActivity(jwtConfig.jwt, otherTopic)
                                .then(function(tsResults){
                                    console.log(tsResults);
                                });
                            });
                        }

                    }else{
                        prop = RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg);
                    }

                    //console.log("Rule: "+i);
                    //console.log("Input value: "+prop);

                    var test = prop;
                    var v1,v2;
                    v1 = RED.util.evaluateNodeProperty(rule.v,rule.vt,node,msg);
                    v2 = rule.v2;
                    if (typeof v2 !== 'undefined') {
                        v2 = RED.util.evaluateNodeProperty(rule.v2,rule.v2t,node,msg);
                    }
                    node.previousValue = prop;
                    if (rule.t == "else") { test = elseflag; elseflag = true; }
                    if (operators[rule.t](test,v1,v2,rule.case)) {
                        if(node.matchall == true && i+1<node.rules.length){
                            continue;
                        }
                        //done
                        node.send(msg);
                        break;
                        
                    } else {
                        if(!node.matchall){
                            continue;
                        }else{
                            break;
                        }
                    }
                }
            } catch(err) {
                node.warn(err);
            }
        }

        //begin by going and getting a JWT for idm user
        getJwt(node.xively_creds).then(function(jwtConfig){
            //setup mqttClient
            node.mqttClient = mqtt.connect("mqtts://",{
                  host: "broker.demo.xively.com",
                  port: Number(8883),
                  username: credentials.account_user_id,
                  password: credentials.mqtt_secret,
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
            RED.log.error("Error setting up XivelyDeviceRuleNode: " + err);
        });

        //begin by going and getting a JWT for idm user

        node.on("close", function() {
            // Called when the node is shutdown 
            if(node.mqttClient){
                node.mqttClient.end(true);
            }
        });
    }

    RED.nodes.registerType("xively-device-rule", XivelyDeviceRuleNode);

}