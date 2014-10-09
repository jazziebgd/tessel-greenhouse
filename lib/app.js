var tessel = require('tessel');
var http = require('http');
var _ = require('lodash');
var async = require('async');

var ledController = require('./ledController');
//var wifi = require('./wifi');
var gprsHttp = require('./gprs-http');
var monitors = require('./monitors');

var app = function(config){
    this.initialize(config);
};

app.prototype.initialize = function(config){
    console.log("Initializing...");
    var that = this;
    this.config = config;
    //this.wifi = new wifi(this.config);
    this.gh = new gprsHttp(this.config);
    this.initialized = false;
    this.ledController = new ledController();
    this.ledController.reset();
   	that.ledController.roll(400, 3);
    setTimeout(function(){
    	that.ledController.blink("orange");
    }, 2000);
    this.reportStatusInterval = null;
    this.monitorInterval = null;
    this.monitors = new monitors();
    this.initqueue = {
        getConfig: false,
        initClimate: false,
        initRelays: false
    }

    async.series([
        //_.bind(that.initializeWifi, that),
        _.bind(that.initializeGprs, that),
        //_.bind(that.resolveServer, that),
    ],
    function(err, results){
        if (err){
        	that.ledController.reset();
        	that.ledController.blink("red", 800);
            console.log(err);
        } else {
            console.log("Starting application...");
            that.start();
        }
    });
}

app.prototype.initializeWifi = function(callback){
    this.wifi.start(callback);
}

app.prototype.initializeGprs = function(callback){
    var that = this;
    this.gh.initialize(function(err, data){
        that.gh.checkNetwork(callback);
    });
}
/**
 * need to resolve kms-dev.com manually since it's dynamic. using static ip server with simple script for that
 */
app.prototype.resolveServer = function(callback){
	console.log("Resolving config server...");
	var that = this;
    that.ledController.stop("blue")
    that.ledController.blink("blue", 800);
    this.gh.getUrl(this.config.server.resolveUrl, function(err, data){
        if (err){
            console.log("Error resolving config server, retrying in 10 seconds...");
            setTimeout(_.bind(that.resolveServer, that, callback));
        } else {
            console.log("Resolved config server (" + data + ").");
            if (data){
                that.config.server.host = data;
            }
            that.ledController.stop("blue")
            callback(err, data);
        }

    });
}

app.prototype.start = function(callback){
    var that = this;
    that.ledController.reset();
    that.ledController.turnOn("orange");
    that.ledController.delayedTurnOff("orange", 1000);
    async.series([
        _.bind(that.loadUserConfig, that),
        _.bind(that.initializeMonitors, that)
    ], function(err, results){
        if (err){
        	that.ledController.reset();
            that.ledController.blink("red", 400);
        	that.ledController.delayedStop("red", 5000);
            console.log(err);
        } else {
            var newSettings = results[0];
            if (typeof newSettings === "string"){
                newSettings = JSON.parse(newSettings);
            }
            _.merge(that.config.settings, newSettings);
	        that.ledController.reset();
	        that.ledController.blink("green", 800);
	        console.log("Application started.");
            that.reportStatusInterval = setInterval(_.bind(that.reportStatus, that), that.config.settings.reportStatusInterval);
	        that.startMonitoring();
    	}
    });
}

app.prototype.refreshConfig = function(){
    var that = this;
    var url = "http://";
    if (that.config.server.auth){
        url += that.config.server.auth.username + ":" + that.config.server.auth.password + '@';
    }
    url += that.config.server.host + that.config.server.actions.getUserConfig
    console.log("Reloading configuration (" + url + ")...");
    that.gh.getUrl(url, function(err, confJson) {
        if (err){
            that.ledController.blink("blue", 400);
            that.ledController.delayedStop("blue", 5000);
            console.log(err);
        } else {
            that.ledController.stop("blue");
            try {
                var userConfig = JSON.parse(confJson);
                _.merge(that.config.settings, userConfig);
                console.log("User config reloaded");
                if (that.config.debug){
                    console.log(confJson);
                }
            } catch (e){
                console.log("Error loading user config", e);
                if (that.config.debug){
                    console.log("Json response: ", confJson);
                }
                that.ledController.blink("red", 400);
                that.ledController.delayedStop("red", 5000);
            }
        }
    });
}


app.prototype.loadUserConfig = function(callback){
    var that = this;
    var url = "http://";
    if (that.config.server.auth){
    	url += that.config.server.auth.username + ":" + that.config.server.auth.password + '@';
    }
    url += that.config.server.host + that.config.server.actions.getUserConfig
    console.log("Loading configuration...");
    if (that.config.debug){
        console.log(url);
    }
    that.ledController.stop("blue")
    that.ledController.blink("blue", 800);
    that.gh.getUrl(url, function(err, confJson) {
        console.log(confJson);
        if (err){
            that.ledController.blink("blue", 400);
            that.ledController.delayedStop("blue", 5000);
            console.log(err);
            callback(err, null);
        } else {
            that.ledController.stop("blue");
            try {
                var userConfig = JSON.parse(confJson);
                console.log("User config loaded.");
                if (that.config.debug){
                    console.log(confJson);
                }
                callback(null, userConfig);
            } catch (e){
                callback(e, null)
            }
        }
    });
}

app.prototype.reportStatus = function(){
    var that = this;
    var status = _.clone(this.monitors.status);

    var url = "http://";
    if (that.config.server.auth){
        url += that.config.server.auth.username + ":" + that.config.server.auth.password + '@';
    }
    url += that.config.server.host + that.config.server.actions.sendStatus;
    console.log("Reporting status...");
    url += "?status=" + encodeURIComponent(JSON.stringify(that.monitors.status));

    that.ledController.stop("blue");
    that.ledController.blink("blue", 800);

    that.gh.getUrl(url, function(err, response) {
        if (err){
            console.log("Reporting status failed!", err);
            that.ledController.blink("blue", 400);
            that.ledController.delayedStop("blue", 5000);
        } else {
            console.log("Reporting status finished.");
            that.refreshConfig();
        }
    });
}

app.prototype.initializeMonitors = function(callback){
    this.monitors.initialize(this.config, callback);
}

app.prototype.startMonitoring = function(){
    this.monitors.start(monitorInterval);
}

module.exports = app;