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
    this.heatingRelayTimeout;
    this.status = {};
    this.isStartingUp = false;
    this.starterRelay = 1;
    this.heatingRelay = 2;
    this.temperatures = [];
    this.humidities = [];
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
        that.climate.readTemperature('c', function (err, temperature) {
            if (err){
                console.log(err);
            }
            that.climate.readHumidity(function (err, humidity) {
                if (err){
                    console.log(err);
                } else {
                    temperature = temperature + that.config.settings.temperature.offset;
                    that.temperatures.push(temperature);
                    if (that.temperatures.length > 10){
                        that.temperatures.shift();
                    }
                    var sum = 0;
                    for(var i=0;i<that.temperatures.length;i++){
                        sum += parseInt(that.temperatures[i], 10); //don't forget to add the base
                    }
                    var avg = sum/that.temperatures.length;
                    that.relay.getState(that.starterRelay, function(err, starterState){
                        if (err){
                            console.log(err);
                        }
                        that.relay.getState(that.heatingRelay, function(err, heatingState){
                            if (err){
                                console.log(err);
                            }
                            that.status = {
                                date: new Date().toString(),
                                heatingState: heatingState,
                                starterState: starterState,
                                temperature: temperature.toFixed(2),
                                humidity: humidity.toFixed(2),
                                settings: {
                                    temperature: that.config.settings.temperature
                                }
                            }
                            if (avg > that.config.settings.temperature.max && heatingState){
                                ledController.turnOn("orange");
                                ledController.delayedTurnOff("orange", 1000);
                                if (!that.isStartingUp){
                                    console.log("Temperature high enough - current " + temperature.toFixed(2) + " \u00B0C, average ' " + avg.toFixed(2) + " \u00B0C, turning heating off");
                                    that.stopHeating(function(err){
                                        if(err){
                                            console.log(err);
                                        } else {
                                            console.log("Heating shutdown procedure complete.");
                                        }
                                    });
                                } else {
                                    console.log("Waiting to complete startup/shutdown procedure.");
                                }
                            } else if (avg < that.config.settings.temperature.min && !heatingState){
                                ledController.turnOn("orange");
                                ledController.delayedTurnOff("orange", 1000);
                                if (!that.isStartingUp){
                                    that.isStartingUp = true;
                                    console.log("Temperature too low - current " + temperature.toFixed(2) + " \u00B0C, average ' " + avg.toFixed(2) + " \u00B0C, turning heating on...");
                                    that.startHeating(function(err, result){
                                        that.isStartingUp = false;
                                        if (err){
                                            console.log(err);
                                        } else {
                                            console.log("Heating startup procedure complete.");
                                        }
                                    });
                                } else {
                                    console.log("Waiting to complete startup/shutdown procedure.");
                                }
                            } else {
                                var stateString = heatingState ? "on" : "off";
                                console.log("Temperature " + temperature.toFixed(2) + " \u00B0C, humidity: " + humidity.toFixed(2) + "% RH, heating " + stateString + ".");
                            }
                        });
                    });
                }
            });
        });
    }
    intervalObj = setInterval(loop, that.config.settings.sensorReadInterval);
}

monitors.prototype.startHeating = function(callback){
    var that = this;
    console.log("Turning starter relay on...");
    ledController.blink("orange", 800);
    that.relay.turnOn(that.starterRelay, function(err){
        if (err){
            ledController.stop("orange");
            ledController.blink("red", 400);
            callback(err, null)
        } else {
            console.log("Starter relay turned on.");
            //read gpio here to make sure generator is running and restart if necessary
            // else
            that.heatingRelayTimeout = setTimeout(function(){
                console.log("Turnig starter relay off...");
                that.relay.turnOff(that.starterRelay, function(err){
                    if (err){
                        console.log(err);
                    } else {
                        console.log("Starter relay turned off.");
                    }
                });
                console.log("Turning heating relay on...");
                that.relay.turnOn(that.heatingRelay, function(err){
                    if (err){
                        ledController.stop("orange");
                        ledController.blink("red", 400);
                        callback(err, null);
                    } else {
                        ledController.stop("orange");
                        console.log("Heating relay turned on.");
                        callback(null, null);
                    }
                });
            }, that.config.settings.power.starterRelayTimeout);
        }
    });
}

monitors.prototype.stopHeating = function(callback){
    var that = this;
    clearTimeout(that.heatingRelayTimeout);
    ledController.blink("orange", 800);
    that.relay.getState(that.starterRelay, function(err, state){
        if (!state){
            that.relay.turnOff(that.heatingRelay, function(err){
                if(err){
                    ledController.stop("orange", 800);
                    ledController.blink("red", 400);
                    callback(err, null);
                } else {
                    ledController.stop("orange");
                    callback(null, null);
                }
            });
        } else {
            that.relay.turnOff(that.starterRelay, function(err){
                if(err){
                    ledController.stop("orange", 800);
                    ledController.blink("red", 400);
                    callback(err, null);
                } else {
                    that.relay.getState(that.heatingRelay, function(err, state){
                        if (err){
                            ledController.stop("orange", 800);
                            ledController.blink("red", 400);
                            callback(err, null);
                        } else {
                            that.relay.turnOff(that.heatingRelay, function(err){
                                if(err){
                                    ledController.stop("orange", 800);
                                    ledController.blink("red", 400);
                                    callback(err, null);
                                } else {
                                    ledController.stop("orange", 800);
                                    callback(null, null);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

module.exports = monitors;