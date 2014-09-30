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

	this._gprsInstructions = [
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
	this.gprsInstructions = [
		{
			command: 'AT+CGATT=1',
			patience: 3000
		},
		{
			command: 'AT+CGDCONT=1,"ip","internet"',
			patience: 3000
		},
		{
			command: 'AT+CIPMUX=0',
			patience: 3000
		},
		{
			command: 'AT+CSTT="internet","telenor","gprs"',
			patience: 3000
		},
		{
			command: 'AT+CIICR',
			patience: 3000
		}
	];
	this.httpGetPrepareInstructions = [
		{
			command: 'AT+HTTPINIT',
			patience: 3000,
			reply: [ 'AT+HTTPINIT', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="CID",1',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="CID",1', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="PROIP","217.065.192.033"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="PROIP","217.065.192.033"', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="PROPORT","8080"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="PROPORT","8080"', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="REDIR","1"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="REDIR","1"', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="TIMEOUT","30"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="TIMEOUT","30"', 'OK' ]
		},
		{
			command: 'AT+HTTPPARA="URL","http://srecnakuma.kms-web.com/get_user_config.php"',
			patience: 5000,
			reply: [ 'AT+HTTPPARA="URL","http://srecnakuma.kms-web.com/get_user_config.php"', 'OK' ]
		},
		{
			command: 'AT+HTTPACTION=0',
			patience: 20000,
			reply: [ 'AT+HTTPACTION=0', 'OK' ]
		},
		{
			command: 'AT+HTTPREAD',
			patience: 20000,
			reply: [ 'AT+HTTPREAD', 'OK' ]
		}
	];
	this.mxHttpGetPrepareInstructions = [
		{
			command: 'AT+CIPSTATUS',
			patience: 3000,
			reply: [ 'AT+CIPSTATUS', 'OK' ]
		},
		{
			command: 'AT+CIPHEAD=1',
			patience: 3000,
			reply: [ 'AT+CIPHEAD=1', 'OK' ]
		},
		{
			command: 'AT+CDNSORIP=0',
			patience: 3000,
			reply: [ 'AT+CDNSORIP=0', 'OK' ]
		},
		{
			command: 'AT+CIPSTART="TCP","78.47.72.53","80"',
			patience: 3000,
			reply: [ 'AT+CIPSTART="TCP","78.47.72.53","80"', 'OK' ]
		},
		{
			command: 'AT+CIPSEND',
			patience: 3000,
			reply: [ 'AT+CIPSEND', 'OK' ]
		},
		{
			command: 'GET /sk.php HTTP/1.1\nConnection: keep-alive\n\n',
			patience: 3000,
			reply: [ 'AT+', 'OK' ]
		}
	]
}

gprsHttp.prototype.initialize = function(callback){
	var that = this;
	var hardware = tessel.port['A']
;	this.gprs = gprslib.use(hardware);
	//  Handle errors
	this.gprs.on('error', function (err) {
  		console.log('Got an error of some kind:\n', err);
	});

	this.gprs.on('ready', function() {
	  	console.log('GSM module initializing...');
		setTimeout(callback, 6000);
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
	  		if (typeof data !== undefined && data.length){
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
	console.log("Executing " + command);
	that.gprs._txrx(command, patience, function(err, data) {
		if (err){
			process.nextTick(function(){
				callback(err, null);
			});
		} else {
			console.log(data);
			process.nextTick(function(){
				callback(null, data);
			});
		}
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
				console.log(data);
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
			console.log("GPRS failed to connect.");
			callback(err, null);
		} else {
			console.log("GPRS connected.");
			callback(null, true);
		}
	});
}

gprsHttp.prototype.isGprsConnected = function(callback, results){
	var command = "AT+CIPCSGP?";
	var reply = ["+CIPCSGP: 1","internet","telenor","gprs", "OK" ];
}

gprsHttp.prototype.gprsConnect = function(callback, results){
	var that = this;
	if (!that.gprsConnected){
		async.retry(5, _.bind(that.tryConnectingGprs, that), function(err, data){
			if (err){
				process.nextTick(function(){
					callback(err, null);
					console.log(err);
				});
			} else {
				process.nextTick(function(){
					callback(null, data);
				});
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
				process.nextTick(function(){
					console.log(err);
					callback(err, null);
				});
			} else {
				process.nextTick(function(){
					that.gprsConnected = 1;
					that.getUrl(url, callback);
				});
			}
		})
	} else {
		async.retry(3,
			function(retryCallback){
				that.tryGet.call(that, url, retryCallback);
			},
			function(err, data){
				if (err){
					process.nextTick(function(){
						console.log(err);
						callback(err, null);
					});
				} else {
					process.nextTick(function(){
						callback(null, data);
					});
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
		var plusHandler = function(data){
			that.handlePlusResponse(data, function(err, data){
				if (err){
					console.log(err);
					callback(err, data);
				} else {
					console.log(data);
					callback(null, data);
				}
			});
		}
		that.gprs.on('+', plusHandler);
		async.eachSeries(this.httpGetPrepareInstructions, function(instruction, instructionCallback){
			console.log("Executing " + instruction.command);
			instruction.command = instruction.command.replace(/\{\{url\}\}/, url);
			that.gprs._txrx(instruction.command, instruction.patience, function(err, data) {
				if (err){
					process.nextTick(function(){
						console.log(err);
						instructionCallback(err, null);
					});
				} else {
					process.nextTick(function(){
						if (data.length > 1 && data[1] === "ERROR"){
							console.log("error at command " + data[0]);
							instructionCallback(new Error("Error on " + data[0]), null);
						} else {
							console.log(data);
							instructionCallback(null, data);
						}
					});
				}
			});
		}, function(err, data){
			if (err){
				// console.log("Html failed.");
				callback(err, null);
				//return tryGet();
			} else {
				console.log("Request sent, waiting for response...");
				setTimeout(function(){
					that.gprs.removeListener('+', plusHandler);
					that.gprs._txrx("AT+HTTPTERM", 10000, function(err, data) {
						process.nextTick(function(){
							that.gprs.postmaster.forceClear();
							callback(new Error("Request failed."), null);
						});
					});
				}, 40000);
			}
		});
	} else {
		console.log("GPRS not connected.");
	}
}

gprsHttp.prototype.interactive = function(){
	var that = this;
	console.log("Entering interactive mode. Type EXIT to exit interactive mode.");
	process.stdin.resume();
	process.stdin.on('data', _.bind(that.executeInteractive, that));
}

module.exports = gprsHttp;