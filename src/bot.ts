import Discord, { ApplicationCommand, ButtonInteraction, CommandInteraction, Guild, GuildMember, Interaction, Message, MessageActionRow, MessageCollector, MessageContextMenuInteraction, MessageEmbed, MessagePayload, MessageSelectMenu, SelectMenuInteraction, TextChannel } from "discord.js";
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { botLoginAuth } from "./auth";
import { FULL_SEND_PERMS, Game, Player, valid_options } from "./game";
import { Role, roles, Side } from "./role";
import { everyone_prevent, shuffle_array, State } from "./util";

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

let happening: {[channel: string]: MessageCollector | Game} = {};

function get_mafia_channel_data(ch: TextChannel): [Discord.Role, Discord.TextChannel] | undefined {
	if(ch.isText() && !ch.isThread() && !!ch.permissionOverwrites.valueOf().find(x => x.type === "role" && ch.guild.roles.cache.get(x.id).name === "Mafia Channel")) {
		return [ch.guild.roles.cache.find(x => x.name === "Mafia Player"), ch.guild.channels.cache.find(x => x.name === "mafia-secret-chat" && x.isText()) as TextChannel];
	} else {
		return undefined;
	}
}

async function player_list_embed(role_mafia_player: Discord.Role) {
	const players = (await role_mafia_player.guild.members.fetch({force: true, withPresences: false}))
	.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id));
	let playerList = "";
	players.toJSON().forEach((player, index) => {
		playerList += `${index + 1}: ${player.user.toString()}\n`;
	});
	return {
		title: "Signed up players",
		description: playerList
	};
}

const setups: {[name: string]: [number, string]} = {
	"confused cops": [5, "[Cop] [ParanoidCop] [InsaneCop] [NaiveCop] [Vanilla]"],
	"solo hooker": [5, "[Blue] [Blue] [Blue] [Cop] [Hooker]"],
	"standoff": [5, "[MachoDoc]x2 [Gunsmith] [Oracle] [Illusionist]"],
	"standoff 6": [6, "[MachoDoc]x2 [Gunsmith] [Oracle] [Vanilla] [Illusionist] -daystart"],
	"standoff 7": [7, "[MachoDoc]x2 [Gunsmith] [Oracle] [Vanilla] [Illusionist] [Angel]"],
	"hookers into dreams": [5, "[Blue]x2 [Doc] [Dreamer] [Hooker]"],
	"hookers into dreams 6": [6, "[Blue]x2 [Doc] [Dreamer] [Vanilla] [Hooker]"],
	"classic": [7, "[Blue]x3 [Doc] [Cop] [Vanilla]x2"],
	"guns and hookers": [7, "[Blue]x3 [Cop] [Gunsmith] [Vanilla] [Hooker]"],
	"fancy pants": [7, "[Blue]x3 [Cop] [Bomb/Gunsmith/Oracle/Doc] [Vanilla] [Janitor]"],
	"fancy hookers": [7, "[Blue]x3 [Cop] [Bomb/Gunsmith/Oracle/Doc] [Vanilla] [Hooker]"],
	"sinister sundown": [7, "[Blue]x2 [Deputy]x2 [Oracle] [Vanilla] [Illusionist]"],
	"cold stone": [7, "[Blue]x3 [Cop] [TalentScout] [Vanilla] [Godfather]"],
	"team cops": [7, "[Blue]x3 [Doc] [Cop]x3 [Vanilla]x2 [Hooker]"],
	//"revengeful 5": [5, "[VengefulBlue]x3 [VengefulVanilla]x2 -nightless -daychat"],
	//"revengeful 7": [7, "[VengefulBlue]x5 [VengefulVanilla]x2 -nightless -daychat"],
	//"revengeful": [11, "[VengefulBlue]x7 [VengefulVanilla]x4 -nightless -daychat"],
	"purgatory": [5, "[Gunsmith] [Cop] [Dreamer] [TalentScout] [Godfather] -nightless"],
	"hope plus one": [14, "[Blue]x7 [MachoDoc]x2 [Cop]x2 [Vanilla]x3 -daystart"]
};

async function signup_message(role_mafia_player: Discord.Role) {
	const player_count = (await role_mafia_player.guild.members.fetch({force: true, withPresences: false}))
	.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id)).size;
	let embed = await player_list_embed(role_mafia_player);
	let opts = [];
	for(let [i, v] of Object.entries(setups)) {
		if(player_count === v[0] || true) {
			opts.push({
				label: i + " (" + v[0] + ")",
				value: v[1],
				description: v[1],
				default: false
			});
		}
	}
	let rows = [new MessageActionRow().addComponents([{
			label: "Sign up", customId: "signup", style: "PRIMARY", type: "BUTTON"
		}, {
			label: "Sign out", customId: "signout", style: "SECONDARY", type: "BUTTON"
		}, {
			label: "Rules", style: "LINK", type: "BUTTON", url: "https://canary.discord.com/channels/485666008128946179/686603623446347899"
		}, {
			label: "Stop", customId: "stopsignup", style: "DANGER", type: "BUTTON"
		}
	])];
	if(opts.length > 0) {
		rows.push(new MessageActionRow().addComponents([
			new MessageSelectMenu().setPlaceholder("Start").setCustomId("start").addOptions(opts)
		]));
	}
	return {
		content: "Signup for a new round of Mafia has started!",
		components: rows, embeds: [embed]
	};
}

async function do_setup(member: GuildMember, channel: TextChannel, message: Message | CommandInteraction | SelectMenuInteraction, setup: string) {
	if(happening[channel.id] instanceof Game || !member.roles.cache.find(x => x.name === "Mafia Manager")) {
		return;
	}
	let data = get_mafia_channel_data(channel);
	if(!data) {
		channel.send("Invalid channel for Mafia.");
		return;
	}
	let [role_mafia_player, mafia_secret_chat] = data;
	let match = setup.match(/\[.*?\](?:x[0-9]+)?(?=\s*)/g);
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
	match = setup.match(/-[a-zA-Z]+/g);
	let options = [];
	if(match) {
		for(let opt of match) {
			opt = opt.substring(1);
			if(valid_options.includes(opt)) {
				options.push(opt);
			} else {
				oerror.push(opt);
			}
		}
	}
	if (error.length != 0 || oerror.length != 0) {
		let text = "";
		if(error.length != 0) {
			text += `Roles not found: ${error.join(", ")}\n`;
		}
		if(oerror.length != 0) {
			text += `Options not found: ${oerror.join(", ")}\n`;
		}
		if(message instanceof Message || message instanceof CommandInteraction) message.reply(text);
		else channel.send(text);
		return;
	}
	//role_mafia_player = await (await role_mafia_player.guild.fetch()).roles.fetch(role_mafia_player.id);
	const player_count = (await role_mafia_player.guild.members.fetch({force: true, withPresences: false}))
		.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id)).size;
	if(player_count === setup_roles.length) {
		let h = happening[channel.id];
		if(h instanceof MessageCollector) {
			h.stop();
			delete happening[channel.id];
		}
		if(message instanceof Message) message.react(kaismile);
		else if(message instanceof CommandInteraction) message.reply("Starting");
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
			p.name = everyone_prevent(member.nickname !== undefined && member.nickname !== null? member.nickname: member.user.username);
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
		channel.send(`Not enough players. You need ${setup_roles.length}, but there are ${player_count}.`);
	} else {
		channel.send(`Too many players. You need ${setup_roles.length}, but there are ${player_count}.`);
	}
}

const cmds = [{
	name: "startsignup",
	description: "startsignup",
	action: async (member: GuildMember, channel: TextChannel, message: Message | CommandInteraction) => {
		if(happening[channel.id] instanceof Game || !member.roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		let data = get_mafia_channel_data(channel);
		if(!data) {
			channel.send("Invalid channel for Mafia.");
			return;
		}
		let [role_mafia_player] = data;
		message.reply(await signup_message(role_mafia_player));
		if(!happening.hasOwnProperty(channel.id)) {
			let col = channel.createMessageCollector();
			happening[channel.id] = col;
			col.on("collect", async (message) => {
				if(message.content === ";signup") {
					message.member.roles.add(role_mafia_player).catch(() => message.reply("Could not add role"));
					message.react(kaismile);
				} else if(message.content === ";signout") {
					message.member.roles.remove(role_mafia_player).catch(() => message.reply("Could not remove role"));
					message.react(kaismile);
				} else if(message.content === ";stopsignup") {
					col.stop();
					delete happening[channel.id];
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
	action: async (member: GuildMember, channel: TextChannel, message: Message | CommandInteraction) => {
		if(!member.roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		if(happening[message.channel.id] instanceof Game) {
			(happening[message.channel.id] as Game).do_state(State.GAME_END);
			delete happening[message.channel.id];
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
		if(message instanceof Message) message.react(kaismile);
		else message.reply("Done");
	},
}, {
	name: "role",
	description: "role",
	options: [{
		name: "name",
		description: "name of the role",
		type: 3,
		required: true 
	}],
	action: async (_member: GuildMember, _channel: TextChannel, message: Message | CommandInteraction) => {
		let m: any;
		if(message instanceof Message) {
			m = message.content.match(/^; *role +([a-zA-Z]+)$/);
			if(!m) return;
			m = m[1];
		} else {
			m = message.options.getString("name");
		}
		let r = Object.values(roles).find(r => r.name.toLowerCase() === m.toLowerCase());
		if(r) {
			message.reply(r.name + " (" + Side[r.side] + "): " + r.help + (r.hidden_help? " " + r.hidden_help: ""));
		} else {
			message.reply("Invalid role name");
		}
	}
}, {
	name: "roles",
	description: "roles",
	action: async (_member: GuildMember, _channel: TextChannel, message: Message | CommandInteraction) => {
		let h = "";
		let replied;
		for(let r of Object.values(roles)) {
			let line = "\n" + Side[r.side][0] + "/" + r.name + ": " + r.help + (r.hidden_help? " " + r.hidden_help: "");
			let h2 = h + line;
			if(h2.length > 2000) {
				if(message instanceof CommandInteraction && message.replied) {
					await message.followUp(h);
				} else {
					await message.reply(h);
				}
				h = line;
			} else h = h2;
		}
		if(message instanceof CommandInteraction && message.replied) {
			message.followUp(h);
		} else {
			message.reply(h);
		}
	}
}, {
	name: "setup",
	description: "setup",
	options: [{
		name: "setup",
		description: "name of setup",
		type: 3,
		required: true 
	}],
	type: 1,
	action: async (member: GuildMember, channel: TextChannel, message: Message | CommandInteraction) => {
		if(happening[channel.id] instanceof Game) return;
		let m;
		if(message instanceof Message) {
			let m2 = message.content.match(/^;\s*setup\s+(.*)$/);
			if(!m2) return;
			m = m2[1];
		} else {
			m = (message as CommandInteraction).options.getString("setup");
		}
		if(happening[channel.id] instanceof Game || !member.roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		if(setups[m]) {
			await do_setup(member, channel, message, setups[m][1]);
		}
	}
}, {
	name: "setupcustom",
	description: "setupcustom",
	options: [{
		name: "setup",
		description: "list of roles and options",
		type: 3,
		required: true 
	}],
	type: 1,
	action: async (member: GuildMember, channel: TextChannel, message: Message | CommandInteraction) => {
		if(happening[channel.id] instanceof Game) return;
		let m;
		if(message instanceof Message) {
			let m2 = message.content.match(/^;\s*setupcustom\s+(.*)$/);
			if(!m2) return;
			m = m2[1];
		} else {
			m = (message as CommandInteraction).options.getString("setup");
		}
		await do_setup(member, channel, message, m);
	}
}, {
	name: "lunch",
	type: 3,
	action: async (member: GuildMember, channel: TextChannel, message: Message | CommandInteraction) => {
		if(message instanceof Interaction && message.isMessageContextMenu()) {
			message.reply(`You ate the message '${everyone_prevent(message.targetMessage.content)}' from ${message.targetMessage.author.username} for lunch.`);
		}
	}
}];

const buttons: {[id: string]: (interaction: ButtonInteraction) => void} = {
	signup: async (interaction: ButtonInteraction) => {
		if(happening[interaction.channel.id] instanceof MessageCollector) {
			interaction.update({});
			let role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			await interaction.guild.members.cache.find(x => x.id === interaction.user.id).roles.add(role_mafia_player).catch(() => interaction.reply("Could not add role"));
			await (interaction.message as Message).edit(await signup_message(role_mafia_player));
		}
	},
	signout: async (interaction: ButtonInteraction) => {
		if(happening[interaction.channel.id] instanceof MessageCollector) {
			interaction.update({});
			let role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			await interaction.guild.members.cache.find(x => x.id === interaction.user.id).roles.remove(role_mafia_player).catch(() => interaction.reply("Could not remove role"));
			await (interaction.message as Message).edit(await signup_message(role_mafia_player));
		}
	},
	stopsignup: async (interaction: ButtonInteraction) => {
		if(happening[interaction.channel.id] instanceof MessageCollector) {
			interaction.update({}).catch(() => {});
			(happening[interaction.channel.id] as MessageCollector).stop();
			delete happening[interaction.channel.id];
			let role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			for(let [_, m] of interaction.guild.members.cache.filter(x => x.id === interaction.user.id)) {
				m.roles.remove(role_mafia_player).catch(() => interaction.reply("Could not remove role").catch(() => {}));
			}
			(interaction.message as Message).edit({content: "Signup ended", components: [], embeds: []});
		}
	}
};

const select_menus: {[id: string]: (interaction: SelectMenuInteraction) => void} = {
	start: async (interaction: SelectMenuInteraction) => {
		if(happening[interaction.channel.id] instanceof MessageCollector) {
			let role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			if(happening[interaction.channel.id] instanceof Game || !(interaction.member as GuildMember).roles.cache.find(x => x.name === "Mafia Manager")) {
				return;
			}
			await do_setup(interaction.member as GuildMember, interaction.channel as TextChannel, interaction, interaction.values[0]);
		}
		interaction.update({});
	}
};

client.on("ready", async () => {
	console.log(`Connected as ${client.user.tag}`);
	let appcmds = await client.application.commands.fetch();
	for(let c of cmds) {
		let appcmd = appcmds.find(x => x.name === c.name);
		//if(appcmd) appcmd.delete();
		if(appcmd) appcmd.edit(c);
		else client.application.commands.create(c);
	}
});

client.on("error", error => {
	console.error(error.message);
});

client.on("messageCreate", async msg => {
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

client.on("interactionCreate", async interaction => {
	if(interaction.isApplicationCommand() || interaction.isCommand()) {
		for(let c of cmds) {
			if(c.name === interaction.commandName) {
				await c.action(await interaction.guild.members.fetch(interaction.user), interaction.channel as Discord.TextChannel, interaction as CommandInteraction);
				break;
			}
		}
	}
	if(interaction.isSelectMenu() && select_menus[interaction.customId]) {
		await select_menus[interaction.customId](interaction);
	}
	if(interaction.isButton() && buttons[interaction.customId]) {
		await buttons[interaction.customId](interaction);
	}
});

client.login(botLoginAuth);
