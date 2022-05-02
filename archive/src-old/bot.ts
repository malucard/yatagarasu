import http = require("http");
import Discord = require("discord.js");
import Mongo = require("mongodb");
import parser = require("discord-command-parser");
import { Command, commands } from "./Command";
import { init_db, config_db, roles_db, is_mafia_channel } from "./db";
import { SetupInstance } from "./Setup";

const client = new Discord.Client();

const server = http.createServer((req, res) => {
	res.end();
});

server.listen();

init_db();

export let setup: SetupInstance;

export function set_setup(s: SetupInstance) {
	setup = s;
}

enum Side {
	NONE,
	VILLAGE,
	MAFIA,
	THIRD
}

client.on("ready", () => {
	console.log("Connected as " + client.user.tag);
});

client.on("error", (error) => {
	console.error(error.message);
});

client.on("message", (message) => {
	if (!config_db || !((message.channel instanceof Discord.TextChannel && is_mafia_channel(message.channel as any as Discord.TextChannel)) || message.channel instanceof Discord.DMChannel)) {
		return;
	}
	let parsed = parser.parse(message, ";;");
	if (parsed.success) {
		if (message.channel instanceof Discord.DMChannel) {
			if (message.channel.recipient.id === "197436970052354049" && parsed.command === "edit" && parsed.arguments.length !== 0) {
				message.channel.fetchMessage(parsed.arguments[0]).then((msg) => {
					msg.edit(parsed.body.substr(parsed.arguments[0].length).trim());
				});
			} else if (setup) {
				for (let p of setup.players) {
					if (p.id === message.author.id) {
						if (parsed.command in p.role.dm_commands) {
							let cmd = p.role.dm_commands[parsed.command];
							if (cmd) cmd(parsed.arguments, message);
						} else if (parsed.command in p.setup.dm_commands) {
							p.setup.dm_commands[parsed.command](parsed.arguments, p, message);
						}
						break;
					}
				}
			}
		} else if (setup && parsed.command in setup.commands) {
			let cmd = setup.commands[parsed.command];
			if (cmd) {
				let player;
				for (let p of setup.players) {
					if (p.id === message.member.id) {
						player = p;
						break;
					}
				}
				if (player) {
					cmd(parsed.arguments, player, message);
				}
			}
		} else {
			let cmd = commands[parsed.command];
			if (cmd) {
				cmd.run(message, parsed.arguments, message.channel as any as Discord.TextChannel);
			}
		}
	}
});

client.login("NTAyOTc0NzIwNTQzNjg2NjU2.DqvvVA.KobwnmoBdeqwPbp8dEgx79bQ_uc");