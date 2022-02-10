"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const Discord = require("discord.js");
const Mongo = require("mongodb");
const parser = require("discord-command-parser");
const Command_1 = require("./Command");
const db_1 = require("./db");
const mclient = new Mongo.MongoClient("mongodb://keebot:keebotdb9@ds035485.mlab.com:35485/keebot");
const client = new Discord.Client();
const server = http.createServer((req, res) => {
    res.end();
});
server.listen();
//let db: {[name: string]: any} = {};
db_1.init_db(); //.then((v) => db = v);
function cleanup() {
    exports.setup = null;
}
exports.cleanup = cleanup;
var Side;
(function (Side) {
    Side[Side["NONE"] = 0] = "NONE";
    Side[Side["VILLAGE"] = 1] = "VILLAGE";
    Side[Side["MAFIA"] = 2] = "MAFIA";
    Side[Side["THIRD"] = 3] = "THIRD";
})(Side || (Side = {}));
client.on("ready", () => {
    console.log("Connected as " + client.user.tag);
});
client.on("error", (error) => {
    console.error(error.message);
});
client.on("message", (message) => {
    if (!db_1.config_db || !(message.channel instanceof Discord.TextChannel) || !db_1.is_mafia_channel(message.channel)) {
        return;
    }
    let parsed = parser.parse(message, ";;");
    if (parsed.success) {
        if (message.channel instanceof Discord.DMChannel) {
            if (message.channel.recipient.id === "197436970052354049") {
                if (parsed.command === "edit" && parsed.arguments.length !== 0) {
                    message.channel.fetchMessage(parsed.arguments[0]).then((msg) => {
                        msg.edit(parsed.body.substr(parsed.arguments[0].length).trim());
                    });
                }
            }
        }
        else {
            let cmd = Command_1.commands[parsed.command];
            if (cmd) {
                cmd.run(message, parsed.arguments, message.channel);
            }
        }
    }
});
client.login("NTAyOTc0NzIwNTQzNjg2NjU2.DqvvVA.KobwnmoBdeqwPbp8dEgx79bQ_uc");
//# sourceMappingURL=bot.js.map