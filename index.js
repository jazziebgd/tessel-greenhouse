var app = require('./lib/app.js');
var conf = require('./conf.json');

setImmediate(function(){
    setTimeout(function(){
    	var tesselGreenhouse = new app(conf);
    }, 1000);
});
