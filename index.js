var express = require('express');
var app = express();
var server = require('http').createServer(app);
var WebSocketServer = require('websocket').server;
var httpPort = 9449;
var port = process.env.port || httpPort;

server.listen(process.env.PORT || port, function() {
    console.log('Please open SSL URL: https://localhost: '+(port)+'/');
});

// app.use(express.static(__dirname + '/'));

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
  });

app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + '/favicon.ico');
});

app.get('/css/style.css', function(req, res) {
    res.sendFile(__dirname + '/css/style.css');
});

app.get('/src/app.js', function(req, res) {
    res.sendFile(__dirname + '/src/app.js');
});

// app.get('/dist/main.js', function(req, res) {
//     res.sendFile('/dist/main.js');
// });

// create websocketserver

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

// Declare the variable connections for rooms and users

var connections = new Array();

// when a user connect:
wsServer.on('request', function(request) {
    // variables declarations
    var guest = 0;
    var room = '';

    // accept coonnection

    var connection = request.accept(null, request.origin);
    console.log((new Date()) + 'Connection accepted.');


    /**
     * When we receive signal message from the client
     */
    connection.on('message', function(message) {
        message = JSON.parse(message.utf8Data);
        console.log(message);
        switch(message["type"]) {

            /**
             * When a user is invited
             * join the room
             */
            case "INVITE" :
                // guest = true;
                room = message["value"];
                console.log(message);
                connections[room].push(connection);
            break;

            /**
             * If you are the first user to connect
             * create room
             */
            case "GETROOM" :
                // room = Math.floor(Math.random()*1000001).toString();
                room = message["value"];
                if(connections[room]) {
                    guest = connections[room].length;
                }
                message = JSON.stringify({'type' : 'GETROOM', 'value': guest});
                connection.send(message);
                console.log(message);
                if(!guest) {
                    guest = true;
                    connections.push(room);
                    connections[room] = new Array();
                    connections[room].push(connection);
                }
            break;

            /**
             * When a user send a SDP message
             * broadcast to all users in the room
             */
            case "candidate" : case "offer" : case "answer" :
                console.log(message);
                connections[room].forEach(function(destination) {
                    if(destination != connection) {
                        message = JSON.stringify(message);
                        destination.send(message);
                    }
                });
            break;
        }
    });


    /**
     * When the user hang up
     * broadcast bye signal to all users in the room
     */
    connection.on('close', function(reasonCode, description) {
        if(connections[room]) {
            connections[room].forEach(function(destination) {
                if(destination != connection) {
                    var message = JSON.stringify({'type' : 'BYE', 'value': ''});
                    destination.send(message);
                }
            });
        }
        connections = new Array();
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});