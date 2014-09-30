var gprsHttp = require("./gprs");
var _ = require("lodash");

var cmd = "interactive";
var urlToGet = "http://srecnakuma.kms-dev.com/get_user_config.php";

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

var gh = new gprsHttp();
gh.initialize(function(){
	console.log("GSM module initialized.")
	gh.gprs.on('+', function(err, data){
			console.log("PLUSResponse");
			console.log(err, data);
		});	
		gh.gprs.on('unsolicited', function(err, data){
			console.log("PLUSResponse");
			console.log(err, data);
		});
	if (cmd === "get"){
		var callback = function(err, data){
			if (err){
			   console.log("Error getting url", err);
			} else {
				console.log("Url get success", data);
			}
			gh.getUrl(urlToGet, callback);
	}

		gh.getUrl(urlToGet, callback);
	} else if (cmd === "test"){
		gh.gprsConnect(function(){

			var go = function(){

				var commands = _.map(gh.httpGetPrepareInstructions, function(item){
					return item.command
				});
				var patiences = _.map(gh.httpGetPrepareInstructions, function(item){
					return item.patience
				});
				var replies = _.map(gh.httpGetPrepareInstructions, function(item){
					return item.reply
				});

				gh.gprs._chain(commands, patiences, replies, function(err, data){
					console.log("chain complete");
					console.log("error:", err);
					console.log("data:", data);
					go();
				});
			}
			go();
		});


	} else {
		var plusHandler = function(data){
		  gh.handlePlusResponse(data, function(err, data){
		    if (err){
		      console.log(err);
		    } else {
		      console.log(data);
		    }
		  });
		}
		gh.gprsConnect(function(){
		  gh.gprs.on('+', function(data){
		    console.log("PLUSResponse");
		    console.log(data);
		  });
		  gh.interactive();
		});
	}
})
