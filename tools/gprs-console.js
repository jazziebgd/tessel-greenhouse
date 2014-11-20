var gprsHttp = require("../lib/gprs-http");
var _ = require("lodash");

var cfg = require('../conf.json');

var cmd = "interactive";
var urlToGet = "http://srecnakuma.kms-web.com/get_user_config.php";

if (process.argv && process.argv.length > 2){
 	if (process.argv[2] == "get"){
 		cmd = "get";
 		if (process.argv.length > 3){
 			urlToGet =  process.argv[3];
 		}
 	} else if (process.argv[2] == "test"){
 		cmd = "test";
 	}
}

var gh = new gprsHttp(cfg);
gh.initialize(function(){
 	gh.checkNetwork(function(){
 		if (cmd === "get"){
 			var callback = function(err, data){
 				if (err){
 					console.log("Error getting url", err);
 					setTimeout(function(){
 						gh.getUrl(urlToGet, callback);
 					}, 1000);
 				} else {
 					console.log("Url get success\n\n", data);
 				}
 			}
 			gh.getUrl(urlToGet, callback);
 		} else {

 			gh.interactive();

			// gh.gprsConnect(function(){
			//   gh.gprs.on('unsolicited', function(data){
			//     console.log("PLUSResponse");
			//     console.log(data);
			//   });
			//   gh.isGprsConnected(function(err, data){
			//   	console.log(err);
			//   	console.log(data);
			//   });
			//   gh.interactive();
			// });
 		}
	});
});
