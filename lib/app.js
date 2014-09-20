var tessel = require('tessel');
var http = require('http');
var _ = require('lodash');
var async = require('async');

var wifi = require('./wifi');
var monitors = require('./monitors');

var app = function(config){
    this.initialize(config);
};

app.prototype.initialize = function(config){
    console.log("Initializing...");
    var that = this;
    this.config = config;
    this.wifi = new wifi(this.config);
    this.initialized = false;
    tessel.led[1].output(1);
    this.blinkInterval = setInterval(function(){
        tessel.led[1].toggle();
    }, 600);
    this.monitorInterval = null;
    this.monitors = new monitors();
    this.initqueue = {
        getConfig: false,
        initClimate: false,
        initRelays: false
    }

    async.series([
        _.bind(that.initializeWifi, that),
        _.bind(that.initializeMonitors, that),
        _.bind(that.start, that)
    ],
    function(err, results){
        if (err){
            console.log(err);
        } else {
            console.log(results);
            console.log("main be here!!!");
        }
    });
}

app.prototype.initializeWifi = function(callback){
    this.wifi.start(callback);
}

app.prototype.start = function(callback){
    var that = this;
    async.series([
        _.bind(that.loadUserConfig, that),
        _.bind(that.initializeMonitors, that)
    ], function(err, results){
        if (err){
            console.log(err);
        }
        console.log(results);
        that.startMonitoring();
    });
}


app.prototype.loadUserConfig = function(callback){
    var that = this;
    var url = that.config.server.host + that.config.server.actions.getUserConfig
    console.log("Loading configuration...");
    that.wifi.get(url, function(err, confJson) {
        if (err){
            console.log(err);
            callback(err, null);
        } else {
            confJson = JSON.parse(confJson);
            console.log(confJson);
            callback(null, confJson);
        }
    });
}

app.prototype.initializeMonitors = function(callback){
    this.monitors.initialize(this.config, callback);
}

app.prototype.startMonitoring = function(){
    this.monitors.start(monitorInterval);
    clearInterval(this.blinkInterval);
    tessel.led[1].output(0);
}

module.exports = app;