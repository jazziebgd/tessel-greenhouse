var tessel = require('tessel');
var gprslib = require('gprs-sim900');

var async = require("async");
var _ = require("lodash");

var gprsHttp = function(config){
	this.config = config;
	this.gprsConnected = false;
	this.httpInitialized = false;
	this.httpFinished = false;
	this.httpTerminated = false;
	this.gprsInstructions = [
		{
			command: 'AT+SAPBR=3,1,"CONTYPE","GPRS"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"APN","internet"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"USER","telenor"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"PWD","gprs"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=1,1',
			patience: 10000
		}
	];
	this.httpGetPrepareInstructions = [
		{
			command: 'AT+HTTPINIT',
			patience: 3000,
			reply: [ 'AT+HTTPINIT', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="URL","{{url}}"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="URL","http://blic.rs"', 'OK' ]
		},
		{
			command: 'AT+HTTPACTION=0',
			patience: 20000,
			reply: [ 'AT+HTTPACTION=0', 'OK' ]
		}
	];
}


gprsHttp.prototype.initialize = function(callback){
	var that = this;
	var hardware = tessel.port['A'];
	this.gprs = gprslib.use(hardware);
	//  Handle errors
	this.gprs.on('error', function (err) {
  		console.log('Got an error of some kind:\n', err);
	});

	this.gprs.on('ready', function() {
	  	console.log('GPRS module connected to Tessel. Searching for network...');
		setTimeout(callback, 10000);
	});
}

gprsHttp.prototype.tryConnectingGprs = function(callback, results){
	var that = this;
	async.eachSeries(that.gprsInstructions, function(instruction, instructionCallback){
		console.log("Executing " + instruction.command);
		that.gprs._txrx(instruction.command, instruction.patience, function(err, data) {
			if (err){
				process.nextTick(function(){
					instructionCallback(err, null);
				});
			} else {
				process.nextTick(function(){
					instructionCallback(null, data);
				});
			}
		});
	}, function(err, data){
		if (err){
			console.log("GPRS failed to connect.");
			callback(err, null);
		} else {
			console.log("GPRS connected.");
			callback(null, true);
		}
	});
}


gprsHttp.prototype.gprsConnect = function(callback, results){
	var that = this;
	if (!that.gprsConnected){
		async.retry(5, _.bind(that.tryConnectingGprs, that), function(err, data){
			if (err){
				callback(err, null);
				console.log(err);
			} else {
				console.log(data);
				callback(null, data);
			}
		});
	} else {
		callback(null, null);
	}
}

gprsHttp.prototype.getUrl = function(url, callback){
	var that = this;
	if (!that.gprsConnected){
		that.gprsConnect(function(err, data){
			if (err){
				console.log(err);
				callback(err, null);
			} else {
				that.gprsConnected = 1;
				that.getUrl(url, callback);
			}
		})
	} else {
		async.retry(3, 
			function(retryCallback){
				that.tryGet.call(that, url, retryCallback);
			}, 
			function(err, data){
				if (err){
					console.log(err);
					console.log(callback);
					console.log(caller);
					console.log(callee);
					callback(err, null);
				} else {
					callback(null, data)
				}
			}
		);
	}
}


gprsHttp.prototype.handlePlusResponse = function(data, callback){
	var that = this;
	var chunks = data.split(':')[1].split(',');
	if (chunks.length < 3){
		callback(new Error("Unrecognizable response.", data));
	} else {
		var status = chunks[1];
		var method = chunks[0] == "0" ? "GET" : chunks[0] == "1" ? "POST" : "HEAD";
		var responseSize = parseInt(chunks[2], 10);
		if (parseInt(status, 10) >= 600){
			setTimeout(function(){
				callback(new Error("Network error " + status), null);
			}, 1000);
		} else {
			var getResponse = '';
			var readCallback = function(response){
				console.log(response);
				callback(null, response);
			}
			if (data[1] !== "ERROR" && status == "200"){
				that.gprs._txrx("AT+HTTPREAD", 30000, function(err, data) {
					if (err){
						console.log("Error reading the document.", err);
						setTimeout(function(){
							callback(err, null);
						}, 1000);
					} else {
						console.log("data ", data);
						console.log("data2 ", data);
						console.log("data2 l ", data[2].length);

						getResponse += data[2];
						if (data[3] === "OK"){
							readCallback(getResponse);
						}
					}
				});
			} else if (status != "200") {
				console.log("Error (?). http status " + status, data, err);
				callback(err, data);
				// setTimeout(function(){
				// 	console.log("Retrying GET");
				// 	callback(new Error("Network error", null);
				// }, 1000);

				//setTimeout(tryGet, 1000);
			}
		}
	}
}


gprsHttp.prototype.tryGet = function(url, callback){
	var that = this;
	if (that.gprsConnected){
		async.eachSeries(this.httpGetPrepareInstructions, function(instruction, instructionCallback){
			console.log("Executing " + instruction.command);
			instruction.command = instruction.command.replace(/\{\{url\}\}/, url);
			that.gprs._txrx(instruction.command, instruction.patience, function(err, data) {
				if (err){
					instructionCallback(err, null);
				} else {
					console.log(data);
					instructionCallback(null, data);
				}
			});
		}, function(err, data){
			if (err){
				// console.log("Html failed.");
				callback(err, null);
				//return tryGet();
			} else {
				var plusHandler = function(data){
					handlePlusResponse(data, function(err, data){
						if (err){
							callback(err, data);
						} else {

						}
					});
				}

				console.log("Request sent, waiting for response...");
				setTimeout(function(){
					that.gprs.removeListener('+', plusHandler);
					that.gprs._txrx("AT+HTTPTERM", 10000, function(err, data) {
						callback(new Error("Request failed."), null);
					});
				}, 90000);

				that.gprs.on('+', plusHandler);

			}
		});
	} else {
		console.log("GPRS not connected.");
	}
}

module.exports = gprsHttp;

var gh = new gprsHttp();
gh.initialize(function(){
	gh.getUrl("http://srecnakuma.kms-dev.com/get_user_config.php");
})
