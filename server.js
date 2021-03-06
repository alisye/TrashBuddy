/**
 * Created by chenji13 on 1/21/2017.
 */
var Clarifai = require('clarifai');
var express = require('express');
var app = express();
var fs = require("fs");
var https = require("https");
var db = require('./db.json');
var uuid = require('uuid');
var cameraSockets = [];
var endUserSockets = [];

var Cclient = new Clarifai.App(
    'vHoj4XdPkGsG1ThB_pvn9QrbldygqdJLGiK2d3Xq',
    'Cg6MqLWNyRQJNNcOHgBmrniToJFqBNooNGdkWko3'
);

// set up public folder routing
app.use(express.static(__dirname + '/public'));

// set up routing
app.get('/', function (req, res ) {
    res.sendFile(__dirname + '/public/index.html');
    // res.sendFile(__dirname + '/public/js/custom.js');
});
app.get('/camera', function (req, res ) {
    res.sendFile(__dirname + '/public/camera.html');
    // res.sendFile(__dirname + '/public/js/custom.js');
});
app.get('/api/daily', function(req, res){
    var newDatabase = {
        "data": db.data.filter(function(item){
            return item.time == 0;
        })
    };
    res.send(JSON.stringify(newDatabase));
});
app.get('/api/weekly', function(req, res){
    var newDatabase = {
      "data": db.data.filter(function(item){
          return item.time <= 1;
      })
    };
    res.send(JSON.stringify(newDatabase));
});
app.get('/api/monthly', function(req, res){
    var newDatabse = {
        "data": db.data.filter(function(item){
            return item.time <= 2;
        })
    };
    res.send(JSON.stringify(newDatabse));
});

var privateKey  = fs.readFileSync('sslcert/key.pem', 'utf8');
var certificate = fs.readFileSync('sslcert/cert.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);
httpsServer.listen(process.env.PORT || 3000, function () {
    var host = httpsServer.address().address;
    var port = httpsServer.address().port;
    console.log('TrashBuddy started at https://%s:%s', host, port);
});


var io = require('socket.io').listen(httpsServer);
io.on('connection', function(socket){
	console.warn("User connected...");
	
	socket.on('image', function(dataX) {
		var image = dataX.image;
        var timeCategory = dataX.timeCategory;
		var base64Data = image.replace(/^data:image\/png;base64,/, "");
		var filename = "out_" + uuid.v4() + ".png";
        var destinationFile = "captures/" + filename;
		fs.writeFile(destinationFile, base64Data, 'base64', function(err) {
			if (err) {
				console.warn(err);
			} else {
				console.warn("Saved file " + filename);
				Cclient.models.predict(Clarifai.FOOD_MODEL, {'base64':base64Data}).then(
					function(response) {
						var name = response.outputs[0].data.concepts[0].name;
                        for (var i=0; i<db.data.length; i += 1){
                            if (name == db.data[i].name){
                                db.data[i].quantity += 1;
                                db.data[i].time = 0;
                                console.log(db.data[i].quantity);
                            }
                        }
						console.warn(name);
                        for (var i=0; i<endUserSockets.length ; i+=1){
                            endUserSockets[i].emit('databaseUpdate', true);   
                        }
					},
					function(err) {
					  // there was an error
					  console.warn(err);
					}
				);
			}
		});
	});
    socket.on('enduser', function(endUser) {
       if (endUser.enduser){
           endUserSockets.push(socket);
       }
        else {
           cameraSockets.push(socket);
       }
    });
	
	socket.on('disconnect', function() {
		console.warn("User left...");
	});
});