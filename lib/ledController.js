var tessel = require("tessel");

var  ledController = function(){
    this.leds = {
        green: tessel.led[0],
        blue: tessel.led[1],
        red: tessel.led[2],
        orange: tessel.led[3]
    };
}

ledController.prototype.getDiode = function(led){
    var diode = false;
    if (typeof led === "string" && this.leds[led]){
        diode = this.leds[led];
    } else if (typeof led === "object") {
        diode = led;
    }
    return diode;
}

ledController.prototype.toggle = function(led){
    var diode = this.getDiode(led);
    if (diode){
        this.stop(diode);
        diode.toggle();
    }
}

ledController.prototype.turnOn = function(led){
    var diode = this.getDiode(led);
    if (diode){
        this.stop(diode);
        diode.output(1);
    }
}

ledController.prototype.turnOff = function(led){
    var diode = this.getDiode(led);
    if (diode){
        this.stop(diode);
        diode.output(0);
    }
}

ledController.prototype.roll = function(interval, repeat){
    if (!interval){
        interval = 1000;
    }
    if (!repeat){
        repeat = 1;
    }
    var ledInterval = parseInt((interval / 4), 10);
    var diodes = [
        this.leds.red,
        this.leds.orange,
        this.leds.green,
        this.leds.blue
    ];
    for(j=1;j<=repeat;j++){
        for(i=0;i<diodes.length;i++){
                this.delayedTurnOn(diodes[i], (j*interval) + (i*ledInterval));
                this.delayedTurnOff(diodes[i], (j*interval) + ((i+1)*ledInterval));
        }
    }
}

ledController.prototype.wave = function(interval, repeat){
    if (!interval){
        interval = 1000;
    }
    if (!repeat){
        repeat = 1;
    }
    var ledInterval = parseInt((interval / 8), 10);
    var diodes = [
        this.leds.red,
        this.leds.orange,
        this.leds.green,
        this.leds.blue
    ];
    for(j=1;j<=repeat;j++){
        for(i=0;i<diodes.length;i++){
            this.delayedTurnOn(diodes[i], (j*interval) + (i*ledInterval));
            this.delayedTurnOff(diodes[i], (j*interval) + (interval - ((i+1)*ledInterval)));
        }
    }
}

ledController.prototype.delayedTurnOn = function(led, delay){
    var that = this;
    if (!delay){
        delay = 1000;
    }
    var diode = this.getDiode(led);
    if (diode){
        setTimeout(function(){
            that.turnOn.call(that, diode);
        }, delay)
    }
}

ledController.prototype.delayedTurnOff = function(led, delay){
    var that = this;
    if (!delay){
        delay = 1000;
    }
    var diode = this.getDiode(led);
    if (diode){
        setTimeout(function(){
            that.turnOff.call(that, diode);
        }, delay)
    }
}

ledController.prototype.delayedStop = function(led, delay){
    var that = this;
    if (!delay){
        delay = 1000;
    }
    var diode = this.getDiode(led);
    if (diode){
        setTimeout(function(){
            that.stop.call(that, diode);
        }, delay);
    }
}

ledController.prototype.delayedBlink = function(led, blinkInterval, delay){
    var that = this;
    if (!delay){
        delay = 1000;
    }
    if (!blinkInterval){
        blinkInterval = 1000;
    }

    var diode = this.getDiode(led);
    if (diode){
        that.stop(diode);
        setTimeout(function(){
            that.blink.call(that, led, blinkInterval);
        }, delay);
    }
}

ledController.prototype.blink = function(led, interval){
    var that = this;
    var diode = this.getDiode(led);
    if (diode){
        that.stop(diode);
        if (!interval){
            interval = 800;
        }
        diode._interval = setInterval(function(){
            diode.toggle();
        }, interval);
    }
}

ledController.prototype.stop = function(led, state){
    var diode = this.getDiode(led);
    if (diode){
        if (!state){
            state = 0;
        }
        if (diode){
            clearInterval(diode._interval);
            clearTimeout(diode._timeout);
            diode.output(state);
        }
    }
}

ledController.prototype.reset = function(){
    this.leds.red.output(0);
    this.leds.green.output(0);
    this.leds.blue.output(0);
    this.leds.orange.output(0);
}

ledController.prototype.set = function(){
    this.leds.red.output(1);
    this.leds.green.output(1);
    this.leds.blue.output(1);
    this.leds.orange.output(1);
}

module.exports = ledController;