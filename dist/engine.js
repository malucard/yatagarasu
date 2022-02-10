"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws = require("ws");
var Arg;
(function (Arg) {
    Arg[Arg["Player"] = 0] = "Player";
})(Arg || (Arg = {}));
class LocalClient {
    constructor() {
        this.commands = {};
    }
    add_command(name) {
        this.commands[name] = [Arg.Player];
    }
    clear_command(name) {
        this.commands = {};
    }
    send_packet(data) {
        data;
    }
}
class Server {
}
class WSServer {
    constructor() {
        this.ws = new ws.Server({ port: 42066 });
        this.ws.on("connection", () => {
        });
    }
}
//# sourceMappingURL=engine.js.map