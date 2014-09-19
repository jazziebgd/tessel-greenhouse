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
		_.bind(that.loadUserConfig, that)
	], this.startMonitoring());
}


app.prototype.loadUserConfig = function(callback){
	var that = this;
	console.log("Loading configuration...");
	console.log(that.config);
	var httpOptions = {
		host: that.config.server.host,
		port: that.config.server.port,
		path: that.config.server.actions.getUserConfig
	};
	if (that.config.server.auth){
		httpOptions.auth = that.config.server.auth.username + ":" + that.config.server.auth.password;
	}

	that.wifi.get(httpOptions, function(res) {
	    var confJson = '';
	    res.on('data', function (data) {
	      confJson += new Buffer(data).toString();
	    });
	    res.on('end', function () {
	    	console.log(res);
	    	if (res.statusCode == "200"){
	      		callback(null, confJson);
	      	} else {
	      		callback("Error connecting", null);
	      	}
	    });
	  }).on('error', function (err) {
	  	console.log('errrrrrr', err);
	    callback(err, null);
	  });
}

app.prototype.startMonitoring = function(){

}

module.exports = app;