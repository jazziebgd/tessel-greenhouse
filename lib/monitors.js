var tessel = require('tessel');
var climatelib = require('climate-si7020');
var relaylib = require('relay-mono');

var ledController = new (require('./ledController'))();

var monitors = function(){

}

monitors.prototype.initialize = function(config, callback){
	console.log("Initializing monitors...");
	var that = this;
	this.config = config;
    this.status = {};
	this.climate = climatelib.use(tessel.port[this.config.hardware.climatePort]);
	this.relay = relaylib.use(tessel.port[this.config.hardware.relayPort]);
	this.relay.on('ready', function relayReady () {
    	console.log("\tRelay module initialized.");
    	that.climate.on('ready', function climateReady () {
    		console.log("\tClimate module initialized.");
    		console.log("Monitors initialized.");
    		callback();
    	});
    });
}

monitors.prototype.start = function(intervalObj) {
	console.log("Starting monitors...");
	var that = this;
	var loop = function() {
		that.climate.readTemperature('c', function (err, temp) {
	        if (err){
	            console.log(err);
	        } else {
	            that.relay.getState(1, function(err, state){
                    that.status = {
                        date: new Date().toString(),
                        relayState: state,
                        temperature: temp.toFixed(2),
                    }
	                if (temp > that.config.settings.temperature.max && state){
                        ledController.turnOn("yellow");
	                    ledController.delayedTurnOff("yellow", 1000);
	                    that.relay.turnOff(1, function toggleOneResult(err) {
	                        console.log("Temperature high enough, turning relay off");
	                    });
	                } else if (temp < that.config.settings.temperature.min && !state){
	                    ledController.turnOn("yellow");
                        ledController.delayedTurnOff("yellow", 1000);
	                    that.relay.turnOn(1, function toggleOneResult(err) {
	                        console.log("Temperature too low, turning relay on");
	                    });
	                } else {
	                    var stateString = state ? "on" : "off";
	                    console.log("Temperature " + temp.toFixed(2) + " \u00B0C, relay " + stateString + ".");
	                }
	            });
        	}
        });
	}
    intervalObj = setInterval(loop, that.config.settings.temperature.interval);
}


module.exports = monitors;