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



module.exports = function(RED) {
    "use strict";
    var url = require('url');
    var fs = require('fs');
    var path = require('path');
    var request = require("request");
    var Mustache = require('mustache');

    var nodeUtil = require("../xi/habanero/nodeUtil");
    var getJwt = require("../xi/habanero/auth").getJwtForCredentialsId;
    var blueprint = require("../xi/services/blueprint");
    var devices = blueprint.devices;

    var DRS_BASE_URL = "https://dash-replenishment-service-na.amazon.com/"

    var templateDir = path.resolve(__dirname+"/templates");

    var signupTemplate = fs.readFileSync(path.join(templateDir,"amazon-replenish-start.mst"),"utf8");
    var registeredTemplate = fs.readFileSync(path.join(templateDir,"amazon-replenish-registered.mst"),"utf8");
    var errorTemplate = fs.readFileSync(path.join(templateDir,"amazon-replenish-error.mst"),"utf8");

    function AmazonLWAConfig(config) {
        RED.nodes.createNode(this, config);
        this.lwa_clientid = config.lwa_clientid
    }

    RED.nodes.registerType("xively-amazon-lwa-config", AmazonLWAConfig);

    function DashProductConfig(config) {
        RED.nodes.createNode(this, config);
        this.model_id = config.model_id;
        this.lwa_clientid = config.lwa_clientid;
        this.reg_page_path = config.reg_page_path;
        this.reg_page_title = config.reg_page_title;
        this.reg_page_header = config.reg_page_header;
        this.reg_page_description = config.reg_page_description;
        this.reg_page_action = config.reg_page_action;
    }

    RED.nodes.registerType("xively-dash-product-config", DashProductConfig);    

    function AmazonReplenishNode (config) {
        RED.nodes.createNode(this,config);

        this.slot_id = config.slot_id;
        this.dash_product = config.dash_product;

        var product = RED.nodes.getNode(config.dash_product);
        var credentials = RED.nodes.getCredentials(config.xively_creds);
        var node = this;

        function replenishSignupBegin(req,res,next) { 
            var hostname = req.protocol + '://' + req.headers.host;

            var return_url = req.protocol + '://' + req.headers.host + "/lwa_return";
            var view = {
                title : product.reg_page_title,
                header : product.reg_page_header,
                description: product.reg_page_description,
                action: product.reg_page_action,
                model_id: product.model_id,
                lwa_clientid: product.lwa_clientid,
                p_node: node.dash_product,
                return_url: return_url
            };
            res.send(Mustache.render(signupTemplate, view));
        }

        function replenishSignup(req,res,next) { 
            var view = {
                title : product.reg_page_title,
                header : product.reg_page_header,
                description: product.reg_page_description,
                action: product.reg_page_action
            };
            res.send(Mustache.render(signupTemplate, view));
        }

        function replenishSignupError(err,req,res,next) {
                node.warn(err);
                res.sendStatus(500);
        }

        var reg_url_path = product.reg_page_path + "/" + product.id;
        RED.httpNode.get(reg_url_path, replenishSignupBegin, replenishSignupError);

        function doReplenish(accessToken, slotId){
            //accessToken = accessToken.replace("Atza|", "");
            //console.log(accessToken);
            var headers = {Authorization: "Bearer "+ accessToken};
            headers["x-amzn-accept-type"] = "com.amazon.dash.replenishment.DrsReplenishResult@1.0";
            headers["x-amzn-type-version"] = "com.amazon.dash.replenishment.DrsReplenishInput@1.0";

            request.post({
                  url: DRS_BASE_URL + "replenish/"+slotId, 
                  headers: headers
                },
                function(err,httpResponse,body){ 
                    try{
                        var resp = JSON.parse(body);
                        //console.log(resp);
                        var eventId = resp.eventInstanceId;
                        var code = resp.detailCode
                        RED.log.info("DrsReplenishResult: " + code);
                    }catch(err){
                        RED.log.warn("Error making replenish request: " + err);
                    }
                }
            );
        }

        this.on ('input', function(msg) {
            nodeUtil.ensureMsgHasDeviceInfo(null, msg).then(function(updatedMsg){
                var accessToken = updatedMsg.device.replenishAuth;
                doReplenish(accessToken, node.slot_id);
            });
        });

        this.on("close",function() {
            var node = this;
            RED.httpNode._router.stack.forEach(function(route,i,routes) {
                if (route.route && route.route.path === reg_url_path && route.route.methods['get']) {
                    routes.splice(i,1);
                }
            });
        });
    }

    RED.nodes.registerType("xively-amazon-replenish", AmazonReplenishNode);

    function doRegistration(serial, accessToken){
        return getJwt(null).then(function(jwtConfig){
            devices.getDevicesBySerial(jwtConfig.account_id, jwtConfig.jwt, serial).then(function(devicesResp){
                if(devicesResp.devices.results.length == 0){
                    throw Error("Unable to find device with serial: "+serial);
                }
                var device = devicesResp.devices.results[0];
                var putBody = {replenishAuth: accessToken};
                devices.putDevice(jwtConfig.jwt, device.id, device.version, putBody).then((putResp) => {
                    if(putResp.hasOwnProperty('error')){
                        RED.log.info("Error setting replenishAuth for device id: "+device.id);
                        RED.log.info(JSON.stringify(putResp));
                    }
                });


            });
        });
    }

    RED.httpNode.get("/lwa_return", function(req, res, next) {
        var b = new Buffer(req.query.state, 'base64');
        var state = JSON.parse(b.toString());
        console.log(state);
        var product = RED.nodes.getNode(state.p_node);
        var view = {
            title : product.reg_page_title
        };
        if(!req.query.error){
            doRegistration(state.serial, req.query.access_token)
            .catch(function(err){
                console.log("Registration error: " + err);
            });

            view.header = "Your device is registered for automated refills";
            res.send(Mustache.render(errorTemplate, view));
        }else{
            RED.log.error("LWA error: "+req.query.error_message + " "+ req.query.error)
            view.header ="There was an error trying to register";
            res.send(Mustache.render(errorTemplate, view));
        }

    });
}