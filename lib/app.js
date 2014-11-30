var tessel = require('tessel');
var http = require('http');
var _ = require('lodash');
var async = require('async');

var ledController = require('./ledController');
var gprsHttp = require('./gprs-http');
var monitors = require('./monitors');

var app = function(config){
    this.initialize(config);
};

/** Initialize the application
 /* 
 /* Calls gprs http module to make sure gsm module is on and connected to
 /* GSM network and then calls this.start()
 /*
 /* @config {Object} Object with application configuration (from ../conf.json)
 */
app.prototype.initialize = function(config){
    console.log("Initializing...");
    var that = this;
    this.config = config;

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

    // Execute all necessary actions in serieas and then start the application.
    async.series([
        _.bind(that.initializeGprs, that)
    ],
    function(err, results){
        if (err){
        	that.ledController.reset();
        	that.ledController.blink("red", 800);
            console.log(err);
            that.initialize(that.config);
        } else {
            console.log("Starting application...");
            that.start();
        }
    });
}

/**
 /* Initialize gprs module
 /*
 /* Initializs gprs http module and makes sure gsm module is on and connected to
 /* GSM network.
 /*
 /* @oaram {Function} Callback function
 */
app.prototype.initializeGprs = function(callback){
    var that = this;
    this.gh.initialize(function(err, data){
        that.gh.checkNetwork(callback);
    });
}

/**
 /* Starts the application
 /*
 /* With hardware initialized (this.initialize), app can start working. Connects to remote server, loads the config
 /* and once successful, starts temperature and humidity monitors and heating checks.
 /*
 /* @oaram {Function} Callback function
 */
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
            console.log("Application start error!");
            console.log(err);
            console.log("Application starting failed, retrying...");
            that.start(callback);
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

/**
 /* Refreshes already loadd configuration from remote server
 */
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

/**
 /* Loads user configuration
 /*
 /* Loads config elements that are configurable by user via the web interface and integrate them into application config
 /*
 /* @oaram {Function} Callback function
 */
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
        if (err){
            that.ledController.blink("blue", 400);
            that.ledController.delayedStop("blue", 5000);
            console.log("Error loading configuration!");
            if (that.config.debug){
                console.log(err);
            }
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


/**
 /* Reports status to remote server
 /*
 /* Uses HTTP GET to call remote url and report current readings and status to remote server
 */
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
            that.loadUserConfig(function(err, results){
                //console.log("npe")
            });
        }
    });
}

/**
 /* Initializes sensors
 /*
 /* Initalizes hardware sensors, sets configuration and executes callback when humidity and temperature monitors are ready.
 /*
 /* @oaram {Function} Callback function
 */
app.prototype.initializeMonitors = function(callback){
    this.monitors.initialize(this.config, callback);
}

/**
 /* Starts monitoring
 /*
 /* Starts infinite loop of sensor readings, setting current values into this.monitors own properties
 /* ready to be read and sent along with status report to remote server (this.reportStatus)
 */
app.prototype.startMonitoring = function(){
    this.monitors.start(monitorInterval);
}

module.exports = app;