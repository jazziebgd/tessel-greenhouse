var _ = require("lodash");
var http = require("http");


var wifiWrapper = function(wifiConfig){
    this.initialize(wifiConfig);
};

wifiWrapper.prototype.initialize = function(wifiConfig){
    console.log("Initializing wifi...");
    var that = this;
    this.config = wifiConfig;
    this.wifi = require('wifi-cc3000');
    this.connected = this.wifi.isConnected();
    this.queue = [];
    this.open = false;
}

wifiWrapper.prototype.start = function(callback){
    var that = this;
    this.wifi.on('connect', function(err, data){
        that.connected = true;
        if (that.queue.length){
            var first = that.queue[0];
            if (!first.type || first.type == "get"){
                that.get(first.options, function(res){
                    var actual = that.queue.shift();
                    first.callback(res);
                });
            }
        }
        console.log("connect emitted", err, data);
        callback(err, data);
    });

    this.wifi.on('disconnect', function(err, data){
        that.connected = false;
        console.log("disconnect emitted", err, data);
    });

    this.wifi.on('timeout', function(err){
        that.connected = false;
        that.connect();
    });

    this.wifi.on('error', function(err){
        // one of the following happened
        // 1. tried to disconnect while not connected
        // 2. tried to disconnect while in the middle of trying to connect
        // 3. tried to initialize a connection without first waiting for a timeout or a disconnect
        console.log("error emitted", err);
    });
    if (!this.connected){
        this.tryConnecting();
    } else {
        callback();
    }
}

wifiWrapper.prototype.tryConnecting = function(){
    if (!this.wifi.isBusy()) {
        this.connect();
    } else {
        process.stdout.write("Wifi busy, trying in 5 seconds");
        for (i=1;i<6;i++){
            setTimeout(function(){
                for(j=0;j<9;j++){
                    process.stdout.write("\u0008");
                }
                process.stdout.write(i + " seconds")
            }, delay, i*1000);
        }
        setTimeout(_.bind(this.tryConnecting, this), 5000);
    }
}

wifiWrapper.prototype.connect = function(){
    this.wifi.connect({
        security: this.config.security,
        ssid: this.config.name,
        password: this.config.password,
        timeout: this.config.timeout
    });
}

wifiWrapper.prototype.get = function(options, callback){
    var that = this;
    if (this.connected){
        http.get(options, callback);
    } else {
        this.tryConnecting()
        this.queue.push({
            type: "get",
            options: options,
            callback: callback,
            context: that
        });
    }
}

module.exports = wifiWrapper;