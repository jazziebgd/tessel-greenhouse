var tessel = require('tessel');
var climatelib = require('climate-si7020');
var relaylib = require('relay-mono');


var monitors = function(){

}

monitors.prototype.initialize = function(config, callback){
	console.log("Initializing monitors...");
	var that = this;
	this.config = config;
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
	                if (temp > that.config.settings.temperature.max && state){
	                    tessel.led[0].output(0);
	                    tessel.led[1].output(1);
	                    tessel.led[2].output(0);
	                    that.relay.turnOff(1, function toggleOneResult(err) {
	                        console.log("Temperature high enough, turning relay off");
	                    });
	                } else if (temp < that.config.settings.temperature.min && !state){
	                    tessel.led[0].output(0);
	                    tessel.led[1].output(1);
	                    tessel.led[2].output(0);
	                    that.relay.turnOn(1, function toggleOneResult(err) {
	                        console.log("Temperature too low, turning relay on");
	                    });
	                } else {
	                    tessel.led[0].output(1);
	                    tessel.led[1].output(0);
	                    tessel.led[2].output(0);
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