const { Console } = require('console');
const express = require('express');
const app = express();
const http = require('http');
const socketio = require('socket.io');
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(__dirname + '/public'));

const PORT = process.env.PORT || 3001;
const { newUser } = require('./helper/helperfun');

let roomPeers = {};
io.sockets.on('connection', socket => {
    socket.on('joinroom', (username, room) => {
        // const user = newUser(socket.id, username, room);
        // console.log(user);
        socket.join(room);
        console.log(room);
        const roomSize = io.sockets.adapter.rooms.get(room).size;
        socket.emit("updateRoom", username, roomSize, socket.id);
        // socket.emit("socketID", socket.id, roomPeers[room]);
    })

    socket.on("message", (message, room) => {
        if (message.type === "offer" || message.type === "answer" || message.candidate) {
            console.log('Message: ', message.type, room);
        }
        socket.to(room).emit("message", message, room);
    })
})

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/views/home.html');
})

app.get('/room', (req, res) => {
    // res.sendFile(__dirname + '/public/views/room.html');
    let roomID = Math.floor(1000 + Math.random() * 9000);
    console.log(roomID);
    res.redirect('/room/' + roomID)
})


app.get('/room/:roomID', (req, res) => {
    let roomid = req.params.roomID;
    console.log("New peer in " + roomid);
    res.sendFile(__dirname + '/public/views/room.html')
})

server.listen(PORT, () => {
    console.log(`Express app listening on PORT ${PORT}`);
})