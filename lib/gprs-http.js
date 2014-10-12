var tessel = require('tessel');
var gprslib = require('gprs-sim900');

var util = require("util");
var async = require("async");
var _ = require("lodash");

var gprsHttp = function(config){
	var that = this;
	this.config = config;
	this.gprsInitialized = false;
	this.httpInitialized = false;
	this.httpFinished = false;
	this.httpTerminated = false;

	this.networkInterval = null;
	this.httpInterval = null;
	this.httpInProgress = false;
	this.httpReadCount = 0;

	this.currentResponse = '';
	this.currentHttpOffset = 0;

	this.gprsInstructions = [
		{
			command: 'AT+SAPBR=3,1,"CONTYPE","GPRS"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"APN","' + that.config.gprs.apn + '"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"USER","' + that.config.gprs.apnUsername + '"',
			patience: 3000
		},
		{
			command: 'AT+SAPBR=3,1,"PWD","' + that.config.gprs.apnPassword + '"',
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
			patience: 3000
		},
		{
			command: 'AT+HTTPPARA="CID",1',
			patience: 5000
		},
		{
			command: 'AT+HTTPPARA="PROIP","' + that.config.gprs.proxyIp + '"',
			patience: 5000
		},
		{
			command: 'AT+HTTPPARA="PROPORT","' + that.config.gprs.proxyPort + '"',
			patience: 5000
		},
		{
			command: 'AT+HTTPPARA="REDIR","1"',
			patience: 5000
		},
		{
			command: 'AT+HTTPPARA="TIMEOUT","' + that.config.gprs.httpTimeout + '"',
			patience: 5000
		},
		{
			command: 'AT+HTTPPARA="URL","{{url}}"',
			patience: 5000
		},
		{
			command: 'AT+HTTPACTION=0',
			patience: 5000
		}
	];
}

util.inherits(gprsHttp, require("events").EventEmitter);

gprsHttp.prototype.initialize = function(callback){
	console.log('GSM module initializing...');

	var that = this;

	that.on("error", _.bind(that.logError, that));

	var hardware = tessel.port[this.config.hardware.gsmPort];

	this.gprs = gprslib.use(hardware);
	//  Handle errors
	this.gprs.on('error', function (err) {
  		that.logError(err);
	});

	this.gprs.on('ready', function() {
	  	console.log('GSM module initialized.');
	  	callback(null, null);
	});
}

gprsHttp.prototype.checkNetwork = function(callback){
	var that = this;
	console.log('Checking GSM network...');
	that.executeCommand("AT+CREG?", 3000, function(err, data){
		if (data[1] === "+CREG: 0,1"){
			console.log("GSM network connected.");
			callback(null, true);
		} else {
			console.log("Connecting to GSM network...");
			that.networkInterval = setInterval(function(){
			that.executeCommand("AT+CREG?", 3000, function(err, data){
				if (err){
					console.log(err);
					console.log("Waiting for GSM network...");
				} else {
					if (data[1] === "+CREG: 0,1"){
						clearInterval(that.networkInterval);
						console.log("GSM network connected.");
						setTimeout(function(){
							callback(null, true);
						}, 1000);
					} else {
						console.log("Waiting for GSM network...");
					}
				}
			});
		}, 5000);
		}
	});
}

gprsHttp.prototype.executeInteractive = function(command){
	var that = this;
	command = String(command).replace(/[\r\n]*$/, '');
	if (command.toLowerCase() === "exit"){
	  	process.stdin.pause();
	  	process.stdin.removeListener('data', _.bind(that.executeInteractive, that))
	} else {
	  	that.executeCommand(command, 120000, function(err, data){
	  		console.log('\nreply:\nerr:\t', err, '\ndata:');
	  		if (typeof data !== "undefined" && data.length){
				data.forEach(function(d) {
					console.log('\t' + d);
				});
			}
	  	});
		console.log('');
	}
}
gprsHttp.prototype.executeCommand = function(command, patience, callback){
	var that = this;
	if (that.config.debug){
		console.log("Executing " + command);
	}
	that.gprs._txrx(command, patience, function(err, data) {
		if (err){
			process.nextTick(function(){
				callback(err, null);
			});
		} else {
			if (that.config.debug){
				console.log(data);
			}
			process.nextTick(function(){
				callback(null, data);
			});
		}
	});
}

gprsHttp.prototype.tryConnectingGprs = function(callback, results){
	var that = this;
	async.eachSeries(that.gprsInstructions, function(instruction, instructionCallback){
		if (that.config.debug){
			console.log("Executing " + instruction.command);
		}
		that.gprs._txrx(instruction.command, instruction.patience, function(err, data) {
			if (err){
				process.nextTick(function(){
					instructionCallback(err, null);
				});
			} else {
				if (that.config.debug){
					console.log(data);
				}
				if (data && data.length && data[1] == "ERROR"){
					process.nextTick(function(){
						instructionCallback(new Error("Error executing " + instruction.command), null);
					});
				} else {
					process.nextTick(function(){
						instructionCallback(null, data);
					});
				}
			}
		});
	}, function(err, data){
		if (err){
			callback(err, null);
		} else {
			callback(null, true);
		}
	});
}

gprsHttp.prototype.isGprsConnected = function(callback){
	var command = "AT+SAPBR=2,1";
	var that = this;
	that.executeCommand(command, 30000, function(err, data){
		if (err){
			console.log("Error checking GPRS connection!" + err);
			callback(err, false);
		} else {
			if (data.length > 1 && !data[1].match(/0\.0\.0\.0/)){
				callback(null, true);
			} else {
				callback(new Error("Not connected to GPRS!"), false);
			}
		}
	})
}

gprsHttp.prototype.gprsConnect = function(callback, results){
	var that = this;
	console.log("Checking GPRS connection...");
	that.isGprsConnected(function(error, gprsConnected){
		if (!gprsConnected){
			async.retry(5, _.bind(that.tryConnectingGprs, that), function(err, data){
				if (err){
					process.nextTick(function(){
						console.log("Error connecting to GPRS!");
						callback(err, null);
					});
				} else {
					process.nextTick(function(){
						console.log("GPRS connection established.");
						callback(null, data);
					});
				}
			});
		} else {
			console.log(data);
			if (data && data.length > 1 && data[1] == "OK"){
				console.log("Reusing existing GPRS connection.");
				callback(null, null);
			} else {
				callback(new Error("Could not determine GPRS status"), null);
			}
		}
	});
}

gprsHttp.prototype.gprsDisconnect = function(callback, results){
	var that = this;
	console.log("Disconnecting GPRS...");
	that.gprs.postmaster.forceClear();
	that.isGprsConnected(function(error, gprsConnected){
		if (!gprsConnected){
			console.log("GPRS already disconnected.");
			callback(null, true);
		} else {
			that.executeCommand("AT+SAPBR=0,1", 5000, function(err, data){
				if (err){
					console.log("Error disconnecting GPRS! ", err);
					callback(err, null);
				} else {
					console.log("GPRS disconnected.");
					callback(null, true);
				}
			});
		}
	});
}


gprsHttp.prototype.getUrl = function(url, callback){
	var that = this;
	if (!that.httpInProgress){
		that.httpInProgress = true;
		that.gprsConnect(function(err, data){
			if (err){
					that.gprsDisconnect(function(error, gprsDisconnected){
						that.httpInProgress = false;
						callback(err, null);
					});
			} else {
				that.executeCommand("AT+HTTPTERM", 10000, function(err, data){
					that.httpInProgress = true;
					async.retry(3,
						function(retryCallback){
							that.tryGet.call(that, url, retryCallback);
						},
						function(err, data){
							if (that.config.debug){
								console.log("TryGet finished.");
								if (err){
									console.log(err);
									console.log(data);
								} else {
									console.log(data);
								}
							}

							if (err){
								that.gprsDisconnect(function(error, gprsDisconnected){
									that.httpInProgress = false;
									callback(err, null);
								})
							} else {
								that.gprsDisconnect(function(err, gprsDisconnected){
									that.httpInProgress = false;
									callback(null, data);
								})
							}
						}
					);
				});
			}
		});
	} else {
		console.log("Request is already in progress, retrying in 10 seconds.");
		setTimeout(_.bind(that.getUrl, that, url, callback), 10000);
	}
}


gprsHttp.prototype.handlePlusResponse = function(data, callback){
	var that = this;
	console.log("plusResponse", data);

}

gprsHttp.prototype.httpRead = function(){
	var that = this;
	var httpStep = that.config.gprs.httpReadBuffer;
	if (that.config.debug){
		console.log("AT+HTTPREAD=" + that.currentHttpOffset + "," + httpStep);
	}
	that.gprs._txrx("AT+HTTPREAD=" + that.currentHttpOffset + "," + httpStep, 10000, function(err, data) {
		if (err){
			console.log(err);
			that.emit("error", err);
			that.emit("failed");
		} else {
			if (data.length > 2){
				if (that.config.debug){
					console.log("httpread chunks: ", data.length);
				}
				var dataChunksLength = data.length;
				if (_.last(data) === "OK"){
					var dataChunks = data.slice(2, dataChunksLength - 1);
					that.currentHttpOffset += httpStep;
					that.currentResponse += dataChunks.join("\n");
					that.emit("read");
				} else {
					console.log("??");
					console.log(data);
				}
			} else if (data.length == 2){
				if (data[1] === "OK" && that.currentResponse){
						that.emit("finished");
				} else {
					// handle unresponsive calls - emit read again couple of times
					if (that.httpReadCount < 5){
						that.httpReadCount++;
						console.log("Waiting for response...");
						setTimeout(function(){
							that.emit("read");
						}, 6000);
					} else {
						console.log("No response from the server after " + (that.httpReadCount+1) + " retries, aborting...");
						that.httpReadCount = 0;
						that.emit("failed");
					}
				}
			} else {
				console.log("?");
				console.log("datalength: ", data.length);
				console.log(data);
			}
		}
	});
}

gprsHttp.prototype.logError = function(error){
	if (this.config.debug){
		console.log(error);
	}
}

gprsHttp.prototype.tryGet = function(url, callback){
	var that = this;
	async.eachSeries(this.httpGetPrepareInstructions, function(instruction, instructionCallback){
		var instructionCommand = instruction.command.replace(/\{\{url\}\}/, url);
		if (that.config.debug){
			console.log("Executing command " + instructionCommand);
		}
		that.gprs._txrx(instructionCommand, instruction.patience, function(err, data) {
			if (err){
				process.nextTick(function(){
					console.log(err);
					instructionCallback(err, null);
				});
			} else {
				if (data.length > 1 && data[1] === "ERROR"){
					console.log("error at command " + data[0]);
					instructionCallback(new Error("Error on " + data[0]), null);
				} else {
					if (that.config.debug){
						console.log(data);
					}
					setTimeout(function(){
						instructionCallback(null, data);
					}, 100);
				}
			}
		});
	}, function(err, data){
		if (err){
			console.log("Request chain failed.");
			callback(err, null);
		} else {
			console.log("Request sent, waiting for response...");
			var httpOffset = 0;
			var httpStep = that.config.gprs.httpReadBuffer;
			var response = "";
			var readHandle = _.bind(that.httpRead, that);

			var finishedHandle = function(){
				that.executeCommand("AT+HTTPTERM", 10000, function(err, data){
					if (err){
						console.log("Error terminating connection", err);
					}
					var response = that.currentResponse;
					console.log("Response received (" + response.length + " b).");
					that.currentHttpOffset = 0;
					that.currentResponse = '';
					callback(null, response);
					that.removeListener("read", readHandle);
					that.removeListener("failed", failedHandle);
				});
			}

			var failedHandle = function(){
				that.executeCommand("AT+HTTPTERM", 10000, function(err, data){
					if (err){
						console.log("Error terminating connection", err);
					}
					that.removeListener("read", readHandle);
					that.removeListener("finished", failedHandle);
					callback(new Error("Request failed"), null);
				});
			}

			that.on("read", readHandle);
			that.emit("read");

			that.once("finished", finishedHandle);

			that.once("failed", failedHandle);
		}
	});
}

gprsHttp.prototype.interactive = function(){
	var that = this;
	console.log("Entering interactive mode. Type EXIT to exit interactive mode.");
	process.stdin.resume();
	process.stdin.on('data', _.bind(that.executeInteractive, that));
}

module.exports = gprsHttp;