import Discord from "discord.js";
import { ApplicationCommandOptionTypes, ApplicationCommandTypes } from "discord.js/typings/enums";
import { CmdKind } from "../../bot";
import { FULL_SEND_PERMS, Game, valid_options, Player } from "./game";
import { Role, roles, Side } from "./role";
import { everyone_prevent, shuffle_array, State } from "./util";

export const mizukithumbsup = "895512297169092729";

export class MafiaCommandBase {
	name: string;
	options?: Discord.ApplicationCommandOptionData[];
	type?: number;
}

export class MafiaCommandTextOrSlash extends MafiaCommandBase implements Discord.ChatInputApplicationCommandData {
	description: string;
	kind?: CmdKind.TEXT_OR_SLASH;
	action: (interaction: Discord.Message | Discord.CommandInteraction, args: string) => Promise<void>;
}

export class MafiaCommandText extends MafiaCommandBase {
	name: string;
	kind: CmdKind.TEXT;
	action: (message: Discord.Message, args: string) => Promise<void>;
}

export class MafiaCommandSlash extends MafiaCommandBase implements Discord.ChatInputApplicationCommandData {
	description: string;
	kind: CmdKind.SLASH;
	action: (interaction: Discord.CommandInteraction, args: string) => Promise<void>;
}

export class MafiaCommandMessageContext extends MafiaCommandBase implements Discord.MessageApplicationCommandData {
	type: ApplicationCommandTypes.MESSAGE;
	kind: CmdKind.MESSAGE_CONTEXT;
	action: (interaction: Discord.MessageContextMenuInteraction) => Promise<void>;
}

export type MafiaCommand = MafiaCommandTextOrSlash | MafiaCommandText | MafiaCommandSlash | MafiaCommandMessageContext;


const setups: { [name: string]: [number, string] } = {
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

export const cmds: MafiaCommand[] = [{
	name: "startsignup",
	description: "startsignup",
	action: async (interaction: Discord.Message | Discord.CommandInteraction) => {
		if (mafiaCommandChecks(interaction, true, true)) {
			let reply: Discord.Message;
			if (interaction instanceof Discord.CommandInteraction) {
				reply = await interaction.deferReply({ fetchReply: true }) as Discord.Message;
			}
			const [role_mafia_player, _mafia_secret_chat] = get_mafia_channel_data(interaction.channel as Discord.TextChannel);
			const reply_opts = await signup_message(role_mafia_player);
			if (reply && interaction instanceof Discord.CommandInteraction) {
				interaction.editReply(reply_opts);
			} else interaction.reply(reply_opts);
		}
	}
}, {
	name: "cleanup",
	description: "cleanup",
	action: async (interaction: Discord.Message | Discord.CommandInteraction) => {
		if (mafiaCommandChecks(interaction, false, true)) {
			const [role_mafia_player, mafia_secret_chat] = get_mafia_channel_data(interaction.channel as Discord.TextChannel);
			mafia_secret_chat.permissionOverwrites.cache.forEach(element => {
				if (element.type === "member") {
					element.delete("cleanup");
				}
			});
			const game = games_happening[interaction.channel.id];
			if (game) {
				game.do_state(State.GAME_END);
				for (const player of Object.values(game.players)) {
					player.member.roles.remove(game.role_mafia_player);
				}
				delete games_happening[interaction.channel.id];
			}
			(interaction.channel as Discord.TextChannel).permissionOverwrites.edit(interaction.guild.roles.everyone, FULL_SEND_PERMS);
			(interaction.channel as Discord.TextChannel).permissionOverwrites.edit(role_mafia_player, FULL_SEND_PERMS);
			if (interaction instanceof Discord.Message) interaction.react(mizukithumbsup);
			else interaction.reply(`<:mizukithumbsup:${mizukithumbsup}>`);
		}
	},
}, {
	name: "partialcleanup",
	description: "partialcleanup",
	action: async (interaction: Discord.Message | Discord.CommandInteraction) => {
		if (mafiaCommandChecks(interaction, false, true)) {
			const [role_mafia_player, mafia_secret_chat] = get_mafia_channel_data(interaction.channel as Discord.TextChannel);
			mafia_secret_chat.permissionOverwrites.cache.forEach(element => {
				if (element.type === "member") {
					element.delete("partialcleanup");
				}
			});
			const game = games_happening[interaction.channel.id];
			if (game) {
				game.do_state(State.GAME_END);
				delete games_happening[interaction.channel.id];
			}
			(interaction.channel as Discord.TextChannel).permissionOverwrites.edit(interaction.guild.roles.everyone, FULL_SEND_PERMS);
			(interaction.channel as Discord.TextChannel).permissionOverwrites.edit(role_mafia_player, FULL_SEND_PERMS);
			if (interaction instanceof Discord.Message) interaction.react(mizukithumbsup);
			else interaction.reply(`<:mizukithumbsup:${mizukithumbsup}>`);
		}
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
	action: async (message: Discord.Message | Discord.CommandInteraction, args: string) => {
		if (mafiaCommandChecks(message)) {
			const role = Object.values(roles).find(role => role.name.toLowerCase() === args.toLowerCase());
			if (role) {
				message.reply(`${role.name} (${Side[role.side]}): ${role.help}${role.hidden_help ? ` ${role.hidden_help}` : ""}`);
			} else {
				message.reply("Invalid role name");
			}
		}
	}
}, {
	name: "roles",
	description: "roles",
	action: async (interaction: Discord.Message | Discord.CommandInteraction) => {
		if (mafiaCommandChecks(interaction, true)) {
			let helperText = "";
			for (const r of Object.values(roles)) {
				const line = `\n${Side[r.side][0]}/${r.name}: ${r.help}${r.hidden_help ? ` ${r.hidden_help}` : ""}`;
				const testConcat = helperText + line;
				if (testConcat.length > 2000) {
					if (interaction instanceof Discord.CommandInteraction && interaction.replied) {
						await interaction.followUp(helperText);
					} else {
						await interaction.reply(helperText);
					}
					helperText = line;
				} else helperText = testConcat;
			}
			if (interaction instanceof Discord.CommandInteraction && interaction.replied) {
				interaction.followUp(helperText);
			} else {
				interaction.reply(helperText);
			}
		}
	}
}, {
	name: "setup",
	description: "setup",
	options: [{
		name: "setup",
		description: "name of setup",
		type: ApplicationCommandOptionTypes.STRING,
		required: true,
		choices: Object.keys(setups).length <= 25 ? Object.keys(setups).map(setup => ({
			name: `${setup} (${setups[setup][0]}) - ${setups[setup][1]}`, value: setup
		})) : undefined
	}],
	action: async (interaction: Discord.Message | Discord.CommandInteraction, args: string) => {
		if (mafiaCommandChecks(interaction, true, true)) {
			if (setups[args]) {
				await do_setup(interaction.member as Discord.GuildMember, interaction.channel as Discord.TextChannel, interaction, setups[args][1]);
			} else {
				interaction.reply("Unknown setup");
			}
		}
	}
}, {
	name: "setupcustom",
	description: "setupcustom",
	options: [{
		name: "setup",
		description: "list of roles and options",
		type: ApplicationCommandOptionTypes.STRING,
		required: true
	}],
	action: async (message: Discord.Message | Discord.CommandInteraction, args: string) => {
		if (mafiaCommandChecks(message, true, true)) {
			if (message instanceof Discord.CommandInteraction) args = message.options.getString("setup");
			await do_setup(message.member as Discord.GuildMember, message.channel as Discord.TextChannel, message, args);
		}
	}
}, {
	name: "players",
	kind: CmdKind.TEXT,
	action: async (message: Discord.Message) => {
		if (mafiaCommandChecks(message)) {
			const role_mafia_player = message.guild.roles.cache.find(x => x.name === "Mafia Player");
			const count = role_mafia_player.members.size;
			if (count < 10) {
				message.react(`${count}\u20e3`);
			} else if (count === 10) {
				message.react("🔟");
			} else if (count < 21) {
				let one = false;
				count.toString().split("").forEach(async (v) => {
					if (v === "1") {
						if (one) {
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
		}
	}
}, {
	name: "playerlist",
	description: "get list of players",
	action: async (message: Discord.Message | Discord.CommandInteraction) => {
		if (mafiaCommandChecks(message)) {
			if (message instanceof Discord.CommandInteraction) return;
			const role_mafia_player = message.guild.roles.cache.find(x => x.name === "Mafia Player");
			const players = role_mafia_player.members;
			if (!players.size) {
				message.reply({
					content: "There are no players currently signed up."
				});
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
	}
}, {
	name: "lunch",
	type: ApplicationCommandTypes.MESSAGE,
	kind: CmdKind.MESSAGE_CONTEXT,
	action: async (interaction: Discord.MessageContextMenuInteraction) => {
		interaction.reply(`You ate the message '${everyone_prevent(interaction.targetMessage.content)}' from ${interaction.targetMessage.author.username} for lunch.`);
	}
}];

export const buttons: { [id: string]: (interaction: Discord.ButtonInteraction) => Promise<void> } = {
	signup: async (interaction: Discord.ButtonInteraction) => {
		if (buttonsCheck(interaction)) {
			interaction.update({});
			const role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			if (role_mafia_player) {
				await interaction.guild.members.cache.find(x => x.id === interaction.user.id).roles.add(role_mafia_player).catch(() => interaction.reply("Could not add role"));
				await (interaction.message as Discord.Message).edit(await signup_message(role_mafia_player));
			}
		}
	},
	signout: async (interaction: Discord.ButtonInteraction) => {
		if (buttonsCheck(interaction)) {
			interaction.update({});
			const role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			if (role_mafia_player) {
				await interaction.guild.members.cache.find(x => x.id === interaction.user.id).roles.remove(role_mafia_player).catch(() => interaction.reply("Could not remove role"));
				await (interaction.message as Discord.Message).edit(await signup_message(role_mafia_player));
			}
		}
	},
	stopsignup: async (interaction: Discord.ButtonInteraction) => {
		if (buttonsCheck(interaction)) {
			if (!(interaction.member as Discord.GuildMember).roles.cache.find(v => v.name === "Mafia Manager")) {
				interaction.reply({ content: "You need the Mafia Manager role for this.", ephemeral: true });
				return;
			}
			const role_mafia_player = interaction.guild.roles.cache.find(x => x.name === "Mafia Player");
			if (role_mafia_player) {
				interaction.update({}).catch((e) => { console.error(e); });
				const players = (await role_mafia_player.guild.members.fetch({ force: true, withPresences: false }))
					.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id));
				players.forEach(member => member.roles
					.remove(role_mafia_player)
					.catch(() => interaction
						.reply("Could not remove role")
						.catch(e => console.error(e))
					)
				);
				await (interaction.message as Discord.Message).edit(await signup_message(role_mafia_player)).catch((e) => { console.error(e); });
			}
		}
	}
};

export const select_menus: { [id: string]: (interaction: Discord.SelectMenuInteraction) => Promise<void> } = {
	start: async interaction => {
		if (games_happening[interaction.channel.id]) return;
		if (!(interaction.member as Discord.GuildMember).roles.cache.find(x => x.name === "Mafia Manager")) {
			return;
		}
		interaction.update({});
		await do_setup(interaction.member as Discord.GuildMember, interaction.channel as Discord.TextChannel, interaction, interaction.values[0]);
	}
};

export const games_happening: { [channel: string]: Game } = {};

function get_mafia_channel_data(channel: Discord.TextChannel): [Discord.Role, Discord.TextChannel] | undefined {
	if (channel.isText() && !channel.isThread() && !!channel.permissionOverwrites.valueOf().find(x => x.type === "role" && channel.guild.roles.cache.get(x.id).name === "Mafia Channel")) {
		return [channel.guild.roles.cache.find(x => x.name === "Mafia Player"), channel.guild.channels.cache.find(x => x.name === "mafia-secret-chat" && x.isText()) as Discord.TextChannel];
	} else {
		return undefined;
	}
}

async function player_list_embed(role_mafia_player: Discord.Role) {
	const players = (await role_mafia_player.guild.members.fetch({ force: true, withPresences: false }))
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

async function signup_message(role_mafia_player: Discord.Role) {
	const embed = await player_list_embed(role_mafia_player);
	const opts = [];
	for (const [i, v] of Object.entries(setups)) {
		opts.push({
			label: `${i} (${v[0]})`,
			value: v[1],
			description: v[1],
			default: false
		});
	}
	const rows = [new Discord.MessageActionRow().addComponents([{
		label: "Sign up", customId: "signup", style: "PRIMARY", type: "BUTTON"
	}, {
		label: "Sign out", customId: "signout", style: "SECONDARY", type: "BUTTON"
	}, {
		label: "Rules", style: "LINK", type: "BUTTON", url: "https://canary.discord.com/channels/485666008128946179/686603623446347899"
	}, {
		label: "Clear", customId: "stopsignup", style: "DANGER", type: "BUTTON"
	}
	])];
	if (opts.length > 0) {
		rows.push(new Discord.MessageActionRow().addComponents([
			new Discord.MessageSelectMenu().setPlaceholder("Start").setCustomId("start").addOptions(opts)
		]));
	}
	return {
		content: "Signup for a new round of Mafia has started!",
		components: rows, embeds: [embed]
	};
}

async function do_setup(member: Discord.GuildMember, channel: Discord.TextChannel, message: Discord.Message | Discord.CommandInteraction | Discord.SelectMenuInteraction, setup: string) {
	if (games_happening[channel.id] || !member.roles.cache.find(x => x.name === "Mafia Manager")) {
		return;
	}
	const data = get_mafia_channel_data(channel);
	if (!data) {
		channel.send("Invalid channel for Mafia.");
		return;
	}
	const [role_mafia_player, mafia_secret_chat] = data;
	let match_array = setup.match(/\[.*?\](?:x[0-9]+)?(?=\s*)/g);
	let setup_roles: Role[] = [];
	const error: string[] = [];
	for (const match of match_array) {
		let count = 1;
		const idx = match.indexOf("]");
		if (match.length > idx + 1) {
			count = parseInt(match.substring(idx + 2));
		}
		const role = match.substring(1, idx);
		const alts = (role.includes("/") ? role.split("/") : [role]).map(roleName => {
			roleName = roleName[0].toUpperCase() + roleName.substring(1);
			if (roleName in roles) {
				return roles[roleName];
			} else {
				error.push(roleName);
			}
		});
		for (let i = 0; i < count; i++) {
			setup_roles.push(alts[Math.floor(Math.random() * alts.length)]);
		}
	}
	const oerror: string[] = [];
	match_array = setup.match(/-[a-zA-Z]+\b/g);
	const options = [];
	if (match_array) {
		for (let opt of match_array) {
			opt = opt.substring(1);
			if (valid_options.includes(opt)) {
				options.push(opt);
			} else {
				oerror.push(opt);
			}
		}
	}
	if (error.length != 0 || oerror.length != 0) {
		let text = "";
		if (error.length != 0) {
			text += `Roles not found: ${error.join(", ")}\n`;
		}
		if (oerror.length != 0) {
			text += `Options not found: ${oerror.join(", ")}\n`;
		}
		if (message instanceof Discord.Message || message instanceof Discord.CommandInteraction) message.reply(text);
		else channel.send(text);
		return;
	}
	//role_mafia_player = await (await role_mafia_player.guild.fetch()).roles.fetch(role_mafia_player.id);
	const player_count = (await role_mafia_player.guild.members.fetch({ force: true, withPresences: false }))
		.filter(memb => !!memb.roles.cache.find(r => r.id === role_mafia_player.id)).size;
	if (player_count === setup_roles.length) {
		if (message instanceof Discord.Message) message.react(mizukithumbsup);
		else if (message instanceof Discord.CommandInteraction) message.reply("Starting");
		const new_game = new Game();
		const players: { [number: number]: Player } = {};
		let all_players = [];
		setup_roles = shuffle_array(setup_roles);
		let i = 0;
		for (const member of role_mafia_player.members.values()) {
			const player = new Player();
			player.game = new_game;
			player.role = setup_roles[i];
			player.member = member;
			player.name = everyone_prevent(member.nickname !== undefined && member.nickname !== null ? member.nickname : member.user.username);
			all_players.push(player);
			i++;
		}
		all_players = shuffle_array(all_players);
		for (let i = 0; i < all_players.length; i++) {
			all_players[i].number = i + 1;
			players[i + 1] = all_players[i];
		}
		new_game.day_channel = channel;
		new_game.mafia_secret_chat = mafia_secret_chat;
		new_game.role_mafia_player = role_mafia_player;
		new_game.options = options;
		new_game.all_players = all_players;
		new_game.players = players;
		new_game.setup = setup;
		games_happening[channel.id] = new_game;
		channel.send(`Setup selected: ${setup}`);
		await new_game.do_state(State.GAME);
	} else if (player_count < setup_roles.length) {
		channel.send(`Not enough players. You need ${setup_roles.length}, but there are ${player_count}.`);
	} else {
		channel.send(`Too many players. You need ${setup_roles.length}, but there are ${player_count}.`);
	}
}

function mafiaCommandChecks(msg_or_interaction: Discord.Message | Discord.BaseCommandInteraction, no_ingame?: boolean, manager_only?: boolean): boolean {
	if (!get_mafia_channel_data(msg_or_interaction.channel as Discord.TextChannel)) return false;
	if (no_ingame && games_happening[msg_or_interaction.channel.id]) return false;
	if (manager_only && !(msg_or_interaction.member as Discord.GuildMember).roles.cache.find(x => x.name === "Mafia Manager")) {
		msg_or_interaction.reply("You need the Mafia Manager role for this.");
		return false;
	}
	return true;
}

function buttonsCheck(interaction: Discord.ButtonInteraction): boolean {
	return !games_happening[interaction.channel.id];
}