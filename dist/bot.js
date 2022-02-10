"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const Discord = require("discord.js");
const parser = require("discord-command-parser");
const Command_1 = require("./Command");
const db_1 = require("./db");
const client = new Discord.Client();
const server = http.createServer((req, res) => {
    res.end();
});
server.listen();
db_1.init_db();
function set_setup(s) {
    exports.setup = s;
}
exports.set_setup = set_setup;
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
    if (!db_1.config_db || !((message.channel instanceof Discord.TextChannel && db_1.is_mafia_channel(message.channel)) || message.channel instanceof Discord.DMChannel)) {
        return;
    }
    let parsed = parser.parse(message, ";;");
    if (parsed.success) {
        if (message.channel instanceof Discord.DMChannel) {
            if (message.channel.recipient.id === "197436970052354049" && parsed.command === "edit" && parsed.arguments.length !== 0) {
                message.channel.fetchMessage(parsed.arguments[0]).then((msg) => {
                    msg.edit(parsed.body.substr(parsed.arguments[0].length).trim());
                });
            }
            else if (exports.setup) {
                for (let p of exports.setup.players) {
                    if (p.id === message.author.id) {
                        if (parsed.command in p.role.dm_commands) {
                            let cmd = p.role.dm_commands[parsed.command];
                            if (cmd)
                                cmd(parsed.arguments, message);
                        }
                        else if (parsed.command in p.setup.dm_commands) {
                            p.setup.dm_commands[parsed.command](parsed.arguments, p, message);
                        }
                        break;
                    }
                }
            }
        }
        else if (exports.setup && parsed.command in exports.setup.commands) {
            let cmd = exports.setup.commands[parsed.command];
            if (cmd) {
                let player;
                for (let p of exports.setup.players) {
                    if (p.id === message.member.id) {
                        player = p;
                        break;
                    }
                }
                if (player) {
                    cmd(parsed.arguments, player, message);
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