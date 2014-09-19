var http = require('http');
var _ = require('lodash');
var async = require('async');

var wifi = require('./wifi');

var app = function(config){
	this.initialize(config);
};

app.prototype.initialize = function(config){
	console.log("Initializing...");
	var that = this;
	this.config = config;
	this.wifi = new wifi(this.config.wifi);
	this.initialized = false;
	this.initqueue = {
		getConfig: false,
		initClimate: false,
		initRelays: false
	}

	async.series([_.bind(that.initializeWifi, that), _.bind(that.start, that)], function(err, results){
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
	async.parallel([
		that.loadUserConfig
	], callback);
}


app.prototype.loadUserConfig = function(callback){
	console.log("Loading configuration...");
	var httpOptions = {
		host: this.config.server.host,
		port: this.config.server.port,
		path: this.config.server.actions.getUserConfig
	};
	if (this.config.server.auth){
		httpOptions.auth = this.config.server.auth.username + ":" + this.config.server.auth.password;
	}

	this.wifi.get(httpOptions, function(res) {
	    var confJson = '';
	    res.on('data', function (data) {
	      confJson += new Buffer(data).toString();
	    })
	    res.on('end', function () {
	    	if (res.statusCode === 200){
	      		callback(null, confJson);
	      	} else {
	      		callback(new Error("Error connecting"), confJson);
	      	}
	    });
	  }).on('error', function (err) {
	    callback(err, null);
	  });
}
module.exports = app;