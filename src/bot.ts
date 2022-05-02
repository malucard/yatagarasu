import Discord, { GuildMember, Message, MessageCollector, TextChannel } from "discord.js";
import { botLoginAuth } from "./auth";
import { FULL_SEND_PERMS, Game, Player } from "./game";
import { Role, roles, Side } from "./role";
import { shuffle_array, State } from "./util";

export const kaismile = "497430068331544577";

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Discord.Intents.FLAGS.DIRECT_MESSAGES,
		Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
	]
});

let signups: {[channel: string]: MessageCollector} = {};

function get_mafia_channel_data(ch: TextChannel): [Discord.Role, Discord.TextChannel] | undefined {
	if(ch.isText() && !ch.isThread() && !!ch.permissionOverwrites.valueOf().find(x => x.type === "role" && ch.guild.roles.cache.get(x.id).name === "Mafia Channel")) {
		return [ch.guild.roles.cache.find(x => x.name === "Mafia Player"), ch.guild.channels.cache.find(x => x.name === "mafia-secret-chat" && x.isText()) as TextChannel];
	} else {
		return undefined;
	}
}

let cmds = [{
	name: "startsignup",
	description: "startsignup",
	action: async (member: GuildMember, channel: TextChannel, _message?: Message) => {
		if(!member.roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		let data = get_mafia_channel_data(channel);
		if(!data) {
			channel.send("Invalid channel for Mafia.");
			return;
		}
		let [role_mafia_player, _mafia_secret_chat] = data;
		channel.send("Signup for a new round of Mafia has started! If you want to join, type `;signup`.");
		if(!signups.hasOwnProperty(channel.id)) {
			let col = channel.createMessageCollector();
			signups[channel.id] = col;
			col.on("collect", async (message) => {
				if(message.content === ";signup") {
					message.member.roles.add(role_mafia_player);
					message.react(kaismile);
				} else if(message.content === ";signout") {
					message.member.roles.remove(role_mafia_player);
					message.react(kaismile);
				} else if(message.content === ";stopsignup") {
					col.stop();
					delete signups[channel.id];
					message.react(kaismile);
				} else if(message.content === ";players") {
					let count = role_mafia_player.members.size;
					if(count < 10) {
						message.react(`${count}\u20e3`);
					} else if(count === 10) {
						message.react("🔟");
					} else if(count < 21) {
						let one = false;
						count.toString().split("").forEach(async (v) => {
							if(v === "1") {
								if(one) {
									await message.react("538537337609781258");
								} else {
									await message.react("1\u20e3");
									one = true;
								}
							} else {
								await message.react(`${v}\u20e3`);
							}
						});
					} else {
						message.reply(count.toString());
					}
				} else if(message.content === ";playerlist") {
					const players = role_mafia_player.members;
					if (!players.size) {
						message.reply({
							content: "There are no players currently signed up."
						})
					} else {
						let playerList = "";
						players.toJSON().forEach((player, index) => {
							playerList += `${index + 1}: ${player.user.toString()}\n`;
						});
						message.reply({
							embeds: [{
								title: "Signed up players",
								description: playerList
							}]
						});
					}
				}
			});
		}
	}
}, {
	name: "partialcleanup",
	description: "partialcleanup",
	action: async (member: GuildMember, channel: TextChannel, message?: Message) => {
		if(!member.roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		let data = get_mafia_channel_data(channel);
		if(!data) {
			channel.send("Invalid channel for Mafia.");
			return;
		}
		let [role_mafia_player, mafia_secret_chat] = data;
		mafia_secret_chat.permissionOverwrites.cache.forEach(element => {
			if(element.type === "member") {
				element.delete("partialcleanup");
			}
		});
		channel.permissionOverwrites.edit(channel.guild.roles.everyone, FULL_SEND_PERMS);
		channel.permissionOverwrites.edit(role_mafia_player, FULL_SEND_PERMS);
		message.react(kaismile);
	},
}, {
	name: "role",
	description: "role",
	action: async (_member: GuildMember, _channel: TextChannel, message?: Message) => {
		let m = message.content.match("; *role +([a-zA-Z]+)");
		if(m) {
			if(roles[m[1]]) {
				message.reply(roles[m[1]].name + " (" + Side[roles[m[1]].side] + "): " + roles[m[1]].help);
			} else {
				message.reply("Invalid role name");
			}
		}
	}
}, {
	name: "roles",
	description: "roles",
	action: async (_member: GuildMember, _channel: TextChannel, message?: Message) => {
		let h = "";
		for(let r of Object.values(roles)) {
			h += "\n" + r.name + " (" + Side[r.side] + "): " + r.help;
		}
		message.reply(h);
	}
}, {
	name: "setupcustom",
	description: "setupcustom",
	action: async (member: GuildMember, channel: TextChannel, message?: Message) => {
		let m = message.content.match(/^;\s*setupcustom\s+(.*)$/);
		if(m) {
			if(!member.roles.cache.find(x => x.name === "Mafia Manager")) {
				return;
			}
			let data = get_mafia_channel_data(channel);
			if(!data) {
				channel.send("Invalid channel for Mafia.");
				return;
			}
			let [role_mafia_player, mafia_secret_chat] = data;
			let match = m[1].match(/\[.*?\](?:x[0-9]+)?(?=\s*)/g);
			let setup_roles: Role[] = [];
			let error: string[] = [];
			for(let m of match) {
				let count = 1;
				let idx = m.indexOf("]");
				if(m.length > idx + 1) {
					count = parseInt(m.substring(idx + 2));
				}
				let role = m.substring(1, idx);
				let alts = (role.includes("/")? role.split("/"): [role]).map(roleName => {
					roleName = roleName[0].toUpperCase() + roleName.substring(1);
					if(roleName in roles) {
						return roles[roleName];
					} else {
						error.push(roleName);
					}
				});
				for(let i = 0; i < count; i++) {
					setup_roles.push(alts[Math.floor(Math.random() * alts.length)]);
				}
			}
			let oerror: string[] = [];
			match = m[1].match(/-[a-zA-Z]+/g);
			let options = [];
			if(match) {
				for(let opt of match) {
					options.push(opt.substring(1));
				}
			}
			if (error.length != 0 || oerror.length != 0) {
				let text = "";
				if(error.length != 0) {
					text += `Roles not found: ${error}\n`;
				}
				if(oerror.length != 0) {
					text += `Options not found: ${oerror}\n`;
				}
				message.reply(text);
				return;
			}
			//role_mafia_player = await (await role_mafia_player.guild.fetch()).roles.fetch(role_mafia_player.id);
			const player_count = (await role_mafia_player.guild.members.fetch({force: true, withPresences: false}))
				.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id)).size;
			if(player_count === setup_roles.length) {
				if(signups[channel.id]) {
					signups[channel.id].stop();
					delete signups[channel.id];
				}
				message.react(kaismile);
				let g = new Game();
				let players: {[number: number]: Player} = {};
				let all_players = [];
				setup_roles = shuffle_array(setup_roles);
				let i = 0;
				for(let member of role_mafia_player.members.values()) {
					let p = new Player();
					p.game = g;
					p.role = setup_roles[i];
					p.member = member;
					p.name = member.nickname;
					all_players.push(p);
					i++;
				}
				all_players = shuffle_array(all_players);
				for(let i = 0; i < all_players.length; i++) {
					all_players[i].number = i + 1;
					players[i + 1] = all_players[i];
				}
				g.day_channel = channel;
				g.mafia_secret_chat = mafia_secret_chat;
				g.role_mafia_player = role_mafia_player;
				g.options = options;
				g.all_players = all_players;
				g.players = players;
				await g.do_state(State.GAME);
			} else if(player_count < setup_roles.length) {
				message.reply(`Not enough players. You need ${setup_roles.length}, but there are ${player_count}.`);
			} else {
				message.reply(`Too many players. You need ${setup_roles.length}, but there are ${player_count}.`);
			}
		}
	}
}];

client.on("ready", () => {
    console.log(`Connected as ${client.user.tag}`);
});

client.on("error", error => {
    console.error(error.message);
});

client.on("message", async msg => {
	let m = msg.content.match(/^; *([a-z]+)/);
	if(m) {
		for(let c of cmds) {
			if(c.name === m[1]) {
				await c.action(msg.member, msg.channel as Discord.TextChannel, msg);
				break;
			}
		}
	}
});

client.login(botLoginAuth);
