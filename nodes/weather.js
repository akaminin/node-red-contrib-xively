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
    
    var request = require("request");
    var when = require("when");

    var xiRed = require('../');
    var WEATHER_DATA_URL = 'https://xi-ext-services.herokuapp.com/api/v1/weather';

    function apiRespDataToWeatherInfo(respData, dataRow){
        var jsun = respData.weather;
        var weather = {data:jsun};
        weather.slug = jsun.daily.data[dataRow].icon;
        weather.summary = jsun.daily.data[dataRow].summary;
        weather.humidity = jsun.daily.data[dataRow].humidity;
        weather.maxtemp = jsun.daily.data[dataRow].temperatureMax;
        weather.mintemp = jsun.daily.data[dataRow].temperatureMin;
        weather.windspeed = jsun.daily.data[dataRow].windSpeed;
        weather.winddirection = jsun.daily.data[dataRow].windBearing;
        weather.lon = jsun.latitude;
        weather.lat = jsun.longitude;
        weather.clouds = jsun.daily.data[dataRow].cloudCover;
        weather.precipitation = jsun.daily.data[dataRow].precipProbability;
        weather.sunrise = jsun.daily.data[dataRow].sunriseTime;
        weather.sunset = jsun.daily.data[dataRow].sunsetTime;
        weather.units = jsun.flags.units;
        weather.time = new Date(jsun.daily.data[dataRow].time*1000);
        weather.title = RED._("weather.message.weather-forecast");
        weather.description = RED._("weather.message.weather-info", {time: weather.time.toLocaleString(), lat: weather.lat, weather: weather.lon});
        return weather;
    }

    function WeatherQueryNode(n) {
        RED.nodes.createNode(this,n);
        this.units = n.units || "us";
        this.xively_creds = n.xively_creds;
        var node = this;

        function queryWeather(lat, lon, date, tomorrow) {
            return when.promise(function(resolve, reject) {
                xiRed.habanero.auth.getJwtForCredentialsId(node.xively_creds).then(function(jwtResp){
                    request.post({
                      url: WEATHER_DATA_URL, 
                      headers: {
                        Authorization: "Bearer "+ jwtResp.jwt
                      },
                      form:{
                        latitude: lat,
                        longitude: lon,
                        date: date
                      }
                    },
                    function(err,httpResponse,body){ 
                        var resp = JSON.parse(body);
                        var dataRow = (tomorrow) ? 1 : 0;
                        var weatherInfo  = apiRespDataToWeatherInfo(resp, dataRow);
                        resolve(weatherInfo);
                    });
                });
            });
        }

        this.on ('input', function(msg) {
            var date;
            var time;
            var year;
            var lat;
            var lon;

            if (n.lat && n.lon) {
                if (90 >= n.lat && 180 >= n.lon && n.lat >= -90 && n.lon >= -180) {
                    lat = n.lat;
                    lon = n.lon;
                } else {
                    node.error(RED._("weather.error.settings-invalid-lat_lon"));
                    return;
                }
            } else if (msg.location) {
                //query node code to check the input for information.
                if (msg.location.lat && msg.location.lon) {
                    if (90 >= msg.location.lat && 180 >= msg.location.lon && msg.location.lat >= -90 && msg.location.lon >= -180) {
                        lat = msg.location.lat;
                        lon = msg.location.lon;
                    } else {
                        node.error(RED._("weather.error.msg-invalid-lat_lon"));
                        return;
                    }
                }
            }

            //the date string is in the format YYYY-MM-DD
            //the time string is in the format HH:MM
            var isoDateStr = null;
            if (n.date && n.time) {
                date = n.date;
                time = n.time;
            }
            else if (msg.time && n.mode === "message") {
                if (msg.time.toISOstring) {
                    isoDateStr = msg.time.toISOString();
                } else if (typeof(msg.time === "string") && !isNaN(parseInt(msg.time))) {
                    var epoch = new Date(parseInt(msg.time));
                    isoDateStr = msg.time.toISOString();
                }
            }

            isoDateStr = isoDateStr || new Date().toISOString();
            date = isoDateStr.substring(0,10);
            time = isoDateStr.substring(11,16);
            year = date.substring(0,4);

            var today = new Date();
            if (today.getFullYear() - year > 60) {
                node.warn(RED._("weather.warn.more-than-60-years"));
            } else if (today.getFullYear() - year < -10) {
                node.warn(RED._("weather.warn.more-than-10-years"));
            }

            queryWeather(lat, lon, isoDateStr, n.mode === "tomorrow").then(function(weatherInfo){
                msg.weather = weatherInfo;
                node.send(msg);
            });
        });
    }

    RED.nodes.registerType("xi-weather-query", WeatherQueryNode);
};