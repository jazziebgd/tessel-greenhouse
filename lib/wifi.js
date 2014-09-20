var _ = require("lodash");
var http = require("http");
var nodeUrl = require('url');

var wifiWrapper = function(config){
    this.initialize(config);
};

wifiWrapper.prototype.initialize = function(config){
    console.log("Initializing wifi...");
    var that = this;
    this.config = config;
    this.wifi = require('wifi-cc3000');
    this.wifiConnected = this.wifi.isConnected();
    this.queue = [];
    this.open = false;
}

wifiWrapper.prototype.start = function(callback){
    var that = this;
    this.wifi.on('connect', function(err, data){
        that.wifiConnected = true;
        if (that.queue.length){
            var first = that.queue[0];
            if (!first.type || first.type == "get"){
                that.get(first.options, function(res){
                    var actual = that.queue.shift();
                    first.callback(res);
                });
            }
        }
        console.log("Wifi connected.", err, data);
        callback(null, true);
    });

    this.wifi.on('disconnect', function(err, data){
        that.wifiConnected = false;
        console.log("Wifi disconnected", err, data);
    });

    this.wifi.on('timeout', function(err){
        that.wifiConnected = false;
        that.connect();
    });

    this.wifi.on('error', function(err){
        // one of the following happened
        // 1. tried to disconnect while not connected
        // 2. tried to disconnect while in the middle of trying to connect
        // 3. tried to initialize a connection without first waiting for a timeout or a disconnect
        console.log("error emitted", err);
    });
    if (!this.wifiConnected){
        this.tryConnecting();
    } else {
        callback(null, true);
    }
}

wifiWrapper.prototype.tryConnecting = function(){
    if (!this.wifi.isBusy()) {
        this.connect();
    } else {
        process.stdout.write("Wifi busy, trying again in 5 seconds");
        setTimeout(_.bind(this.tryConnecting, this), 5000);
    }
}

wifiWrapper.prototype.connect = function(){
    this.wifi.connect({
        security: this.config.wifi.security,
        ssid: this.config.wifi.name,
        password: this.config.wifi.password,
        timeout: this.config.wifi.timeout
    });
}

wifiWrapper.prototype.get = function(url, callback){
    var that = this;
    if (this.wifiConnected){
        var output = '';
        http.get(url, function(res){
            res.setEncoding("utf-8");
            res.on('data', function (data) {
              output += new Buffer(data).toString();
            })
            res.on('end', function () {
              callback(null, output);
            })
          }).on('error', function (e) {
            callback(e, null);
          });
    } else {
        this.tryConnecting();
        callback(new Error("Could not get url"), false);
    }
}

module.exports = wifiWrapper;