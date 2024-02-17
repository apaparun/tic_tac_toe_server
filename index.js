
//importing packages
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 3000;
var server = http.createServer(app);
const Room = require('./model/room')
var io = require("socket.io")(server);
// const io = new Server(server);
//middleware conver all client data to json format
app.use(express.json());

const DB = "mongodb+srv://arunprasanth488:NXUrpMRKIrckCeYi@cluster0.krjhtlm.mongodb.net/?retryWrites=true&w=majority";
io.on("connection", socket => {
    console.log("socket connected");
    socket.on("createRoom", async ({ nickname }) => {
        console.log(nickname)
        try {
            let room = new Room();
            let player = {
                socketID: socket.id,
                nickname,
                playerType: 'X'
            }
            room.players.push(player)
            room.turn = player;
            room = await room.save();
            const roomId = room._id.toString();
            console.log(roomId)
            socket.join(roomId)
            //io -> send data to everyone
            //socket -> send data to yourself

            io.to(roomId).emit("createRoomSuccess", room);
        } catch (e) {
            console.log(e);
        }
    });

    socket.on("joinRoom", async ({ nickname, roomId }) => {
        try {
            if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
                socket.emit('errorOccured', "Please Enter Valid Room ID");
                return;
            }
            let room = await Room.findById(roomId);
            if (room.isJoin) {
                let player = {
                    nickname,
                    socketID: socket.id,
                    playerType: "O"
                };
                socket.join(roomId);
                room.isJoin = false;
                room.players.push(player);
                room = await room.save();
                io.to(roomId).emit("joinRoomSuccess", room);
                io.to(roomId).emit("updatePlayers", room.players);
                io.to(roomId).emit("updateRoom", room);
            } else {
                socket.emit('errorOccured', "Game is in progress join again later...");
                return;

            }
        } catch (e) {
            console.log(e);
        }
    });
    socket.on('tap', async ({ index, roomId }) => {
        try {
            let room = await Room.findById(roomId);
            let choice = room.turn.playerType;
            if (room.turnIndex == 0) {
                room.turn = room.players[1];
                room.turnIndex = 1;
            } else {
                room.turn = room.players[0];
                room.turnIndex = 0;
            }
            room = await room.save();

            io.to(roomId).emit("tapped", {
                index, choice, room
            })

        } catch (e) {
            console.log(e);
        }
    });

    socket.on('winner', async ({ winnerSocketId, roomId }) => {
        try {
            let room = await Room.findById(roomId);
            let player = room.players.find((player) => player.socketID == winnerSocketId);
            player.points += 1;
            room = await room.save();
            if (player.points >= room.maxRounds) {
                io.to(roomId).emit('endGame', player)
            } else {
                io.to(roomId).emit('pointIncrease', player)

            }
        } catch (e) {
            console.log(e);
        }
    });



});

mongoose.connect(DB).then(() => {
    console.log("connected successfully");
}).catch((e) => {
    console.log(`error---${e}`);
})
server.listen(port, "0.0.0.0", () => {
    console.log(`server running on port ${port}`)
});