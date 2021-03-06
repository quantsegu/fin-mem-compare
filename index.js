//this script must be run from 
//get-process openfin,chrome | select-object PID, Name, Description, PrivateMemorySize, WS
var cefPath = 'executables\\cef\\cef_binary_3.1750.1738_windows32_client\\release\\cefclient.exe';
var chromiumPath = 'executables\\chromium\\300055\\chrome.exe';
var openfinPath = "executables\\openfin\\openfin.cmd";

var dataCmd = ".\\fetchMemoryStats.ps1";

var http = require('http');
var urlParser = require('url');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec
var Q = require('q');

var toKill = [];
var numWindows = 10;

var count = Date.now()
var config = {
	"desktop_core_url": "https://demoappdirectory.openf.in/desktop/desktopcore/2.0.7/index.html", 
	"desktop_controller_url": "https://demoappdirectory.openf.in/desktop/desktopcontroller/2.0.7/index.html",
    "startup_app": {
        "autoShow": true,
        "name": "finmemcomp",
        "uuid": "finmemcomp",
        "url": "http://www.google.com",
        "contextMenu" : true
    },
    "runtime": {
        "arguments": "",
        "version": "v35"
    },
    "shortcut": {
        "company": "OpenFin",
        "description": "webapp to generate an openfin runtie app.json",
        "name": "dyno app.json"
    }
};

var app = http.createServer(function(req,res){
  	var queryData = urlParser.parse(req.url, true).query;
  	var id = queryData.name || 'dyno' + (count++);
  	var version = queryData.version || 'v35';
	var url = queryData.url || 'http://www.google.com';
	config.startup_app.name = id;
	config.startup_app.uuid = id;
	config.startup_app.url = url;
	config.runtime.version = version
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(config, null, 3));
});

app.listen(5000);
console.log('started web server on port 5000');

var launch = function(pause, cmd, callback) {
	try {
		console.log(cmd);
		var spawned = spawn(cmd);
		toKill.push(spawned);
		setTimeout(function() { callback(undefined, spawned)}, pause);
	}
	catch (err) {
		callback(err, undefined);
	}
}

var qLaunch = Q.nbind(launch);


var launchMany = function(count, cmd, pause) {
	var current = qLaunch(pause, cmd);
	for (var i = 1; i < count; i++) {
		current = current.then(function(args) {return qLaunch(pause, cmd)});
	}
	return current;
}

Q.all([
	launchMany(numWindows, cefPath, 5000),
	launchMany(numWindows, chromiumPath, 3000),
	launchMany(numWindows, openfinPath, 10000)
]).then(function() {
	setTimeout(function() {
		fetchMemoryStats(function(result){
			console.log(result);
			killAll(result);
			systemExit();
		});
	}, 5000);
}, function(err) {
	console.log('error');
});


var fetchMemoryStats = function(handler) {
	var output = [];
	var spawn = require("child_process").spawn;
	var child = spawn("powershell.exe",[dataCmd]);
	child.stdout.on("data",function(data){
		var line = data.toString('utf8');
		output.push(line);
	});
	child.stderr.on("data",function(data){
	    console.log("Powershell Errors: " + data);
	});
	child.on("exit",function(){
	    console.log("Powershell Script finished");
	    var everything = output.join("");
	    var lines = everything.split('\r');
	    //peel of the first \n character
	    lines = lines.map(function(e) { return e.substring(1); } );
	    var result = [];
	    var msg = [];
	    for (var i  = 0 ; i < lines.length; i++)
	    	{
	    		var each = lines[i].trim();
	    		if (each.length > 0) {
	    			var split = each.split(":");
	    			var key = split[0].trim().toLowerCase();
	    			var value = split[1].trim();
	    			if (key === 'id') {
	    				msg = {
	    					id: value
	    				}
	    				result.push(msg);
	    			}
	    			else
	    			{
	    				msg[key] = value;
	    			}
	    		}
	    	}
	    handler(result);
	});
	child.stdin.end(); //end input
}
	
var killAll = function(data) {
	for (var i = 0; i < data.length; i++)
		{
			var each = data[i];
			var id = each.id;
			if (id) {
				var killer = 'taskkill /F /PID ' + id;
				console.log(killer);
				exec(killer);
			}
		}

}


var systemExit = function() {
	setTimeout(function() {
		console.log('bye!');
		process.exit(0);
	},2000);
}


