// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

process.title = 'node-chat';

var httpPort = 8080;
var webSocketsServerPort = 1337;
var webSocketServer = require('websocket').server;
var http = require('http');


var fs = require('fs');

/**
 * Global variables
 */

var historyData = {
  "messages": [],
  "players": {}
}

var clients = [ ];

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


// Array with some colors
//var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
var colors = [
  rgbToHex(133, 53, 53), //czerwony
  rgbToHex(50, 180, 80), //niebieski
  rgbToHex(70, 120, 70), //zielony
  rgbToHex(135, 80, 130), //fiolet
  rgbToHex(80, 170, 180), //blekit
  rgbToHex(125, 135, 35) //zolty
];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

/**
 * HTTP server
 *
 */
var server = http.createServer(function(request, response) {
// Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
// WebSocket server is tied to a HTTP server. WebSocket request is just
// an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin);
    var index = clients.push(connection) - 1;

    var userName = false;
    var userColor = false;

    console.log((new Date()) + ' Connection accepted.');

    connection.sendUTF(JSON.stringify( { event: 'history', data: historyData}));
    connection.on('message', function(message) {
        //console.log(message);
        //console.log(message.type);
        if (message.type === 'utf8') { // accept only text
            var msg = JSON.parse(message.utf8Data);
            console.log(msg);
            if (userName === false) {
                if (msg.event === "login"){
                    userName = htmlEntities(msg.data.username);
                    userColor = colors.shift();
                    historyData.players[userName] = {username: userName, color: userColor};


                    connection.sendUTF(JSON.stringify({ event:'auth', data: {username: userName, color: userColor }}));
                    for (var i=0; i < clients.length; i++) {
                        clients[i].sendUTF(JSON.stringify({ event: 'logged_in', data: {username: userName, color: userColor}}));
                    }

                    console.log((new Date()) + ' User is known as: ' + userName
                        + ' with ' + userColor + ' color.');
                }
            } else { // log and broadcast the message
                console.log((new Date()) + ' Received Message from '
                    + userName + ': ' + message.utf8Data);
                if (msg.event === "chat" || msg.event === "roll") {
                    if (msg.event === "chat") {
                      var chat_msg = {
                          event: "chat",
                          data: {
                              event: "chat",
                              time: (new Date()).getTime(),
                              message: htmlEntities(msg['data']['message']),
                              author: userName,
                              color: userColor
                          }
                      };
                    }
                    else {
                      var rolls = [];
                      for (var i = 0; i < msg['data']['count']; ++i) {
                        rolls.push(getRandomInt(1, msg['data']['dim']));
                      }
                      var chat_msg = {
                          event: "roll",
                          data: {
                              event: "roll",
                              time: (new Date()).getTime(),
                              dim: msg['data']['dim'],
                              count: msg['data']['count'],
                              rolls: rolls,
                              author: userName,
                              color: userColor
                          }
                      };
                    }
                    historyData['messages'].push(chat_msg);
                    historyData['messages'] = historyData['messages'].slice(-100);
                    var json = JSON.stringify(chat_msg);
                    for (var i=0; i < clients.length; i++) {
                        clients[i].sendUTF(json);
                    }
                }

            }
        }
    } );

    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            clients.splice(index, 1);
            delete historyData.players[userName];
            colors.push(userColor);
            for (var i=0; i < clients.length; i++) {

                clients[i].sendUTF(JSON.stringify({ event: 'logged_out', data: {username: userName}}));
            }

        }
    });

});
