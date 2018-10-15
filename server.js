var http = require('http');
var fs = require('fs');
var io = require('socket.io');

var players = {
    1: 'cpu',
    2: 'cpu',
    3: 'cpu',
    4: 'cpu'
};

var playerPos = {
    1: {x: 10, y: 150},
    2: {x: 380, y: 150},
    3: {x: 150, y: 10},
    4: {x: 150, y: 380}
};

var server = http.createServer(function(request, response){
    fs.readFile('index.html', function(error, data){
        response.end(data);
    });
});

var debug = false;
var socket = io(server);
var playerCount = 0;
var names = [];
var reload = true;
var pos = {x: 195, y: 195};
var move = ball();
var winner = null;
var paused = true;
var fieldSize = 400;
var ballSize = 10;
var maxPos = fieldSize - ballSize;
var lastTouch = 0;
var step = 50;
var speed = 0;
var score = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

function pick(a, b) {
    return [a, b][Math.round(Math.random())]
}

function ball() {
    var x = 1 + rand(.5, 1.5);
    var y = 1 + rand(.5, 1.5);

    return {x: pick(0, 1) ? -1 * x : x, y: pick(0, 1) ? -1 * y : y};
}

function reset(ballOnly) {
    pos = {x: 195, y: 195};
    move = ball();
    lastTouch = 0;

    if (ballOnly) {
        return;
    }

    winner = null;
    paused = true;
    score = {
        1: 0,
        2: 0,
        3: 0,
        4: 0
    };

    playerPos = {
        1: {x: 10, y: 150},
        2: {x: 380, y: 150},
        3: {x: 150, y: 10},
        4: {x: 150, y: 380}
    };
}

function abs(v) {
    return Math.abs(v);
}

function round(val, dec) {
    return !dec ? Math.round(val) : Math.round(val * (10 * dec)) / (10 * dec);
}

function between(v, min, max) {
    return v >= min && v <= max;
}

function rand(min, max) {
    return round((min + (Math.random() * (abs(min) + abs(max)))), 1);
}

function clean(arr) {
    var arr2 = [];
    for (var i in arr) {
        if (arr.hasOwnProperty(i) && arr[i]) {
            arr2.push(arr[i]);
        }
    }

    return arr2;
}

socket.on('connection', function(client){
    playerCount++;
    var playId = playerCount;

    var clientData = {name: 'player'+playerCount};
    names.push(clientData.name);

    client.broadcast.emit('message', clientData.name + ' joined' + (playerCount > 4 ? ' as spectator' : ''));
    client.emit('message',  'joined as ' + clientData.name);
    client.emit('setId', playId);
    socket.emit('updatePlayerList', names);

    client.on('updatePos', function(change){
        change = change ? step : -step;
        if (playId > 2) {
            playerPos[playId].x += change;
            playerPos[playId].x < 0 && (playerPos[playId].x = 0);
            playerPos[playId].x > fieldSize - 100 && (playerPos[playId].x = fieldSize - 100);
        } else {
            playerPos[playId].y += change;
            playerPos[playId].y < 0 && (playerPos[playId].y = 0);
            playerPos[playId].y > fieldSize - 100 && (playerPos[playId].y = fieldSize - 100);
        }
    });

    console.log('client joined', client.id, clientData.name);

    client.on('disconnect', function(reason){
        socket.emit('message', clientData.name + ' left');
        playerCount--;
        console.log('client left', client.id, clientData.name, reason);
        delete(names[names.indexOf(clientData.name)]);
        names = clean(names);
        socket.emit('updatePlayerList', names);
    });

    client.on('pause', function(){
        paused = !paused;
    });

    client.on('setName', function(name){
        names[names.indexOf(clientData.name)] = name;
        clientData.name = name;

        socket.emit('updatePlayerList', names);
    });

    socket.emit('updatePlayerList', names);

    client.on('reset', function(){
        reset();
    });
});

function updateBall() {
    if (!paused) {
        pos.x += move.x;
        pos.y += move.y;

        speed = round(abs(move.x) + abs(move.y), 1);

        pos.x < 0 && (pos.x = 0);
        pos.x > maxPos && (pos.x = maxPos);

        for (var p = playerCount + 1; p <= 4; p++) {
            if (p > 2) {
                if (pos.x + 5 < playerPos[p].x + 50) {
                    playerPos[p].x -= step;
                }

                if (pos.x + 5 > playerPos[p].x + 50) {
                    playerPos[p].x += step;
                }

                playerPos[p].x > 300 && (playerPos[p].x = 300);
                playerPos[p].x < 0 && (playerPos[p].x = 0);
                
            } else {
                if (pos.y + 5 < playerPos[p].y + 50) {
                    playerPos[p].y -= step;
                }

                if (pos.y + 5 > playerPos[p].y + 50) {
                    playerPos[p].y += step;
                }
                
                playerPos[p].y > 300 && (playerPos[p].y = 300);
                playerPos[p].y < 0 && (playerPos[p].y = 0);
            }
        }

        var middleBar = 0;
        var middleBall = 0;
        var speedSum = 0;
        var speedChange = 0;
        var speedDiff = 0;

        if (between(pos.x, 10, 20) && between(pos.y, playerPos[1].y - 10, playerPos[1].y + 100)) {
            move.x *= -1.1;
            middleBar = playerPos[1].y + 50;
            middleBall = pos.y + 5;

            speedSum = abs(move.x) + abs(move.y);
            move.y += middleBall < middleBar ? -rand(0, move.y < 1 ? 1 : move.y)*2 : (middleBall > middleBar ? rand(0, move.y < 1 ? 1 : move.y)*2 : 0);
            speedChange = abs(move.x) + abs(move.y);

            if (speedChange < speedSum) {
                speedDiff = speedSum - speedChange;
                move.x += move.x > 0 ? speedDiff : -speedDiff;
            }

            pos.x = 20;
            lastTouch = 1;
        } else if (between(pos.x, 370, 380) && between(pos.y, playerPos[2].y - 10, playerPos[2].y + 100)) {
            move.x *= -1.1;
            middleBar = playerPos[2].y + 50;
            middleBall = pos.y + 5;

            speedSum = abs(move.x) + abs(move.y);
            move.y += middleBall < middleBar ? -rand(0, move.y < 1 ? 1 : move.y)*2 : (middleBall > middleBar ? rand(0, move.y < 1 ? 1 : move.y)*2 : 0);
            speedChange = abs(move.x) + abs(move.y);

            if (speedChange < speedSum) {
                speedDiff = speedSum - speedChange;
                move.x += move.x > 0 ? speedDiff : -speedDiff;
            }

            pos.x = 370;
            lastTouch = 2;
        } else if (pos.x >= 390 || pos.x <= 0) {
            if (pos.x <= 0) {
                pos.x = 0;
                score[lastTouch]++;
                reset(true);
            } else {
                pos.x = 390;
                score[lastTouch]++;
                reset(true);
            }

            move.x *= -1.1;
        }


        if (between(pos.y, 10, 20) && between(pos.x, playerPos[3].x - 10, playerPos[3].x + 100)) {
            move.y *= -1.1;
            
            if (playerCount > 2) {
                middleBar = playerPos[2].x + 50;
                middleBall = pos.x + 5;

                speedSum = abs(move.x) + abs(move.y);
                move.x += middleBall < middleBar ? -rand(0, move.x < 1 ? 1 : move.x)*2 : (middleBall > middleBar ? rand(0, move.x < 1 ? 1 : move.x)*2 : 0);
                speedChange = abs(move.x) + abs(move.y);

                if (speedChange < speedSum) {
                    speedDiff = speedSum - speedChange;
                    move.y += move.y > 0 ? speedDiff : -speedDiff;
                }

                lastTouch = 3;
            }

            pos.y = 20;
        } else if (between(pos.y, 370, 380) && between(pos.x, playerPos[4].x - 10, playerPos[4].x + 100)) {
            move.y *= -1.1;

            if (playerCount > 3) {
                middleBar = playerPos[2].x + 50;
                middleBall = pos.x + 5;
                speedSum = abs(move.x) + abs(move.y);
                move.x += middleBall < middleBar ? -rand(0, move.x < 1 ? 1 : move.x)*2 : (middleBall > middleBar ? rand(0, move.x < 1 ? 1 : move.x)*2 : 0);
                speedChange = abs(move.x) + abs(move.y);

                if (speedChange < speedSum) {
                    speedDiff = speedSum - speedChange;
                    move.y += move.y > 0 ? speedDiff : -speedDiff;
                }

                lastTouch = 4;
            }

            pos.y = 370;
        }
        else if (pos.y >= 390 || pos.y <= 0) {
            if (pos.y <= 0) {
                pos.y = 0;
                score[lastTouch]++;
                reset(true);
            } else {
                pos.y = 390;
                score[lastTouch]++;
                reset(true);
            }

            move.y *= -1.1
        }

        // max speed check
        move.x > 9 && (move.x = 9);
        move.x < -9 && (move.x = -9);
        move.y > 9 && (move.y = 9);
        move.y < -9 && (move.y = -9);

        // roundings
        pos.x = round(pos.x, 1);
        pos.y = round(pos.y, 1);
        move.x = round(move.x, 1);
        move.y = round(move.y, 1);

        for (var s in score) {
            if (score.hasOwnProperty(s) && score[s] > 9) {
                winner = names[s-1] || 'CPU';
                break;
            }
        }
    }
}

setInterval(function(){
    updateBall();

    socket.emit('update', {
        paused: paused,
        ball: pos,
        players: playerPos,
        move: move,
        score: score,
        lastTouch: lastTouch,
        speed: speed,
        debug: debug,
        reload: reload,
        winner: winner
    });

    reload = false;
}, 16);

server.listen(3000);
