import http = require("http");
import Discord = require("discord.js");
import Mongo = require("mongodb");
import parser = require("discord-command-parser");
import {Command, commands} from "./Command";
import {init_db, config_db, roles_db, is_mafia_channel} from "./db";
import {SetupInstance} from "./Setup";

const mclient = new Mongo.MongoClient("mongodb://keebot:keebotdb9@ds035485.mlab.com:35485/keebot");

const client = new Discord.Client();

const server = http.createServer((req, res) => {
	res.end();
});

server.listen();

//let db: {[name: string]: any} = {};
init_db();//.then((v) => db = v);

export let setup: SetupInstance;

export function cleanup() {
	setup = null;
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
	if(!config_db || !(message.channel instanceof Discord.TextChannel) || !is_mafia_channel(message.channel as any as Discord.TextChannel)) {
		return;
	}
	let parsed = parser.parse(message, ";;");
	if(parsed.success) {
		if(message.channel instanceof Discord.DMChannel) {
			if(message.channel.recipient.id === "197436970052354049") {
				if(parsed.command === "edit" && parsed.arguments.length !== 0) {
					message.channel.fetchMessage(parsed.arguments[0]).then((msg) => {
						msg.edit(parsed.body.substr(parsed.arguments[0].length).trim());
					});
				}
			}
		} else {
			let cmd = commands[parsed.command];
			if(cmd) {
				cmd.run(message, parsed.arguments, message.channel as any as Discord.TextChannel);
			}
		}
	}
});

client.login("NTAyOTc0NzIwNTQzNjg2NjU2.DqvvVA.KobwnmoBdeqwPbp8dEgx79bQ_uc");
