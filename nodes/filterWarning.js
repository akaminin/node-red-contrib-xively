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

    function FilterWarningNode (config) {
        RED.nodes.createNode(this,config);

        this.trigger_value = config.trigger_value;
        this.trigger_repeat = config.trigger_repeat;

        var node = this;

        var context = node.context();

        function filterMessage(msg){
            var now = new Date();
            if(!msg.payload.hasOwnProperty('filter')){
                return;
            }

            if(parseInt(msg.payload.filter.value) > node.trigger_value){
                return;
            }
            var last_case_created = context.get('last_case_created');
            if(typeof last_case_created != "undefined"){
                last_case_created = new Date(last_case_created);
            }

            if(last_case_created instanceof Date){
                var nextCase = new Date(last_case_created.getTime() + (node.trigger_repeat*60000));
                if(now < nextCase){
                    return;
                }
            }
            context.set('last_case_created', now);
            node.send(msg);
        }

        node.on('input', function (msg) {
            filterMessage(msg);
        });

        node.on("close", function() {
            // Called when the node is shutdown 
        });
    }

    RED.nodes.registerType("filter-warning", FilterWarningNode);
}