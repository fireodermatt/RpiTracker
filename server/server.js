/**
 * Author : Kos-M
 * Email : t13droid@gmail.com
 * Date : 11/3/2020
 * Description: This is websocket server ,its supposed to run in a server with a domain , or a static ip
 * in order all clients can reach it .All connections are client initiated , server is here to gather all info.
 */
const WebSocket = require('ws');
const Protocol = require('../protocol');
const moment = require('moment');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const express = require('express');
const app = express()
const routes = require('./routes/index');
const dotenv = require('dotenv');
const Helper = require('./Helper.js');
dotenv.config();

moment.suppressDeprecationWarnings = true;

const ControlPort = process.env.web_interface_port || 3000;
const socket_server_port = process.env.socket_server_port || 8080;
const KEEP_ALIVE = process.env.socket_keep_alive || 10000;
//const printConnections_Interval = process.env.printConnections_Interval || 30000;
//setInterval(printConnections, printConnections_Interval);
const Logger = Helper.Logger;
var clientInfo = [];

const wss = new WebSocket.Server({ port: socket_server_port }, () => {
  Logger("Server initiated , listeninng on " + socket_server_port)
});
let active = wss._server._connections;

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');

var sessionMidle = session({
  secret: 'keyboard_cat',
  resave: true,
  saveUninitialized: true,
  loggedin: null
})
app.locals.moment = require('moment');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMidle);
app.use(function (req, res, next) {
  res.active = active;
  res.clientInfo = clientInfo;
  next();
});

app.use('/', routes)
app.listen(ControlPort, () => Logger(`Admin web interface started on port ${ControlPort}`))

function noop() { }
function heartbeat() { // pong
  this.isAlive = true;
  process.stdout.write("•")
}
wss.on('connection', function connection(ws, req) {

  /**
   * Sends message , or command to client , exec is true only when sending a command!
   *  @params {String msg , Boolean exec} 
   */
  async function Send(msg, exec = false) {
    let obj = {}
    if (exec)
      obj = { "msg": "execute", "command": `${msg}` }
    else
      obj = { "msg": `${msg}` }
    let data = JSON.stringify(obj)
    ws.send(data)
  }
  ws.isAlive = true;
  this.conn_establish_ = null;
  ws.on('pong', heartbeat);
  ws.onclose = event => { //ws.readyState
    Logger("socket closed with code: " + event.code) // event.code === 1000  event.reason === "Work complete"  event.wasClean === true (clean close)
    clientInfo = Helper.deleteByiD(ws.id , clientInfo)
    active--;
  };
  ws.on('message', function incoming(message) {
    let ans = JSON.parse(message)
    switch (ans.msg) {
      case Protocol.Connecting:
        this.id = ans.id
        this.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);
        if (this.ip.substr(0, 7) == "::ffff:")
          this.ip = this.ip.substr(7)
        if (this.id === undefined) {
          Send(Protocol.ERROR.INVALID_ID)
          clearInterval(this.interval)
          this.terminate()
          Logger("ERROR :INVALID_ID client:" + this.ip)
          break;
        }
        let Push = true;
        this.conn_establish_ = new Date();
        Logger('Client ' + this.ip + ' connected ' + moment(this.conn_establish_).fromNow());
        Send(Protocol.Connected);
        Send(Protocol.GET_UP_TIME, true);
        Send(Protocol.GET_OS, true);
        Send(Protocol.GET_HOST_NAME, true);
        for (let i = 0; i < clientInfo.length; i++) {
          if (clientInfo[i].id == this.id) {
            clientInfo[i].ip = this.ip;
            Push = false;
          }
          clientInfo[i].connected = this.conn_establish_;
        }
        if (Push) 
          clientInfo.push({ "hostname": null, "os": null, "ip": this.ip, "connected": this.conn_establish_, "uptime": this.uptime, "id": this.id })          
        active++;
        break;
      case Protocol.ANS_UPTIME:
        this.uptime = ans.value
        for (let x = 0; x < clientInfo.length; x++) {
          if (clientInfo[x].id === this.id) {
            clientInfo[x].uptime = this.uptime;
          }
        }
        break;
      case Protocol.ANS_OS:
        this.os = ans.value;
        for (let x = 0; x < clientInfo.length; x++) {
          if (clientInfo[x].id === this.id) {
            clientInfo[x].os = this.os;
          }
        }
        break;
      case Protocol.ANS_HOST_NAME:
        this.host_name = ans.value;
        for (let x = 0; x < clientInfo.length; x++) {
          if (clientInfo[x].id === this.id) {
            clientInfo[x].hostname = this.host_name;
          }
        }
        break;
      default:
        if (typeof (ans) != String) {
          Logger("Uknown type of Object")
          console.dir(ans)
          break;
        }
        Logger("Unknown type of incomming message :" + ans)
    }
  });
});
this.interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      Logger("terminate session")
      deleteByiD(ws.id)
      clearInterval(this.interval)
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(noop);
  });
}, KEEP_ALIVE);

async function printConnections() {
  //active = wss._server._connections
  //Logger("Connections:" + active)
  // for (i = 0; i < clientInfo.length; i++)
  //  console.dir(clientInfo[i])
}





