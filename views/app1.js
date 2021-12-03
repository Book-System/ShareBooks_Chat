const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

let users = [];
const messages = {
    general : [],
    random : [],
    jokes : [],
    javascript : []
}
io.on('connection',function(socket){
    socket.on("join server",function(username) {
        const user = {
            username,
            id : socket.id,
        };
        users.push(user);
        io.emit("new user",users)
    });

    socket.on("join room", function(roomName,cb){
        socket.join(roomName);
        cb(messages[roomName]);
        socket.emit("joined",messages[roomName]);
    });

    socket.on("send message", function({content,to,sender,chatName,isChannel}){
        if(isChannel){
            const payload = {
                content,
                chatName,
                sender
            };
            socket.to(to).emit("new message",payload);
        } else {
            const payload = {
                content,
                chatName,
                sender
            };
            socket.to(to).emit("new message",payload);
        }
        if(messages[chatName]){
            messages[chatName].push({
                sender,
                content
            })
        }
    });
    socket.on("disconnect", () =>{
        users = users.filter(u => u.id !== socket.id);
        io.emit("new user", users);
    })
});

server.listen(3000, ()=> console.log('server is running on port 3000'))