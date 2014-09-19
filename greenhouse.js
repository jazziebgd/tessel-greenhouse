var tessel = require('tessel');
var climatelib = require('climate-si7020');
var relaylib = require('relay-mono');

var climate = climatelib.use(tessel.port['C']);
var relay = relaylib.use(tessel.port['D']);


tessel.led[0].output(1);
tessel.led[1].output(1);
tessel.led[2].output(1);

setTimeout(function(){
    tessel.led[0].output(0);
    tessel.led[1].output(0);
    tessel.led[2].output(0);
}, 1000);

relay.on('ready', function relayReady () {
    console.log("Relay initialized");
    climate.on('ready', function () {
        console.log("Climate initialized");
        setImmediate(function loop () {
            climate.readTemperature('c', function (err, temp) {
                if (err){
                    console.log(err);
                } else {
                    relay.getState(1, function(err, state){
                        if (temp > 30 && state){
                            tessel.led[0].output(0);
                            tessel.led[1].output(1);
                            tessel.led[2].output(0);
                            relay.turnOff(1, function toggleOneResult(err) {
                                console.log("Temperature high enough, turning relay off");
                            });
                        } else if (temp < 30 && !state){
                            tessel.led[0].output(0);
                            tessel.led[1].output(0);
                            tessel.led[2].output(1);
                            relay.turnOn(1, function toggleOneResult(err) {
                                console.log("Temperature too low, turning relay on");
                            });
                        } else {
                            tessel.led[0].output(1);
                            tessel.led[1].output(0);
                            tessel.led[2].output(0);
                            console.log("Temperature ( " + temp + " C), relay state " + state + ", no action taken.");
                        }
                    });
                }
                setTimeout(loop, 1000);
            });
        });
    });
});

climate.on('error', function(err) {
    console.log('error connecting module', err);
});