import { init_db, config_db, get_confirm_react, get_error_react, get_player_role, has_perms, random_in, get_secret_channel } from "./db";
import { set_can_see, set_can_speak, clear_member_overwrites, get_everyone } from "./ChannelManager";
import Discord = require("discord.js");
import { Setup, setups } from "./Setup";
import { roles } from "./Role";
import Player from "./Player";
import { setup, set_setup } from "./bot"

export class Command {
	run: (msg: Discord.Message, args: string[], channel: Discord.TextChannel) => void;
	constructor(run: (msg: Discord.Message, args: string[], channel: Discord.TextChannel) => void) {
		this.run = run;
	}
}

let signing_up = true;

export let commands: { [name: string]: Command } = {
	reloaddb: new Command((msg) => {
		msg.react(get_confirm_react());
		init_db();
	}),
	startsignup: new Command((msg, args, channel) => {
		if (!setup && has_perms(msg.member)) {
			msg.react(get_confirm_react());
			signing_up = true;
		}
	}),
	stopsignup: new Command((msg, args, channel) => {
		if (!setup && has_perms(msg.member)) {
			msg.react(get_confirm_react());
			signing_up = false;
		}
	}),
	signup: new Command((msg, args, channel) => {
		if (signing_up) {
			msg.member.addRole(get_player_role(channel.guild));
			msg.react(get_confirm_react());
		} else {
			msg.react(get_error_react());
		}
	}),
	signout: new Command((msg, args, channel) => {
		if (!setup) {
			msg.member.removeRole(get_player_role(channel.guild));
			msg.react(get_confirm_react());
		}
	}),
	kick: new Command((msg, args, channel) => {
		if (args[1] && args[1].match(/^<@!?[0-9]{16,18}>$/) && has_perms(msg.member)) {
			let player = get_player_role(channel.guild);
			if (msg.member.roles.find(x => x.id === player.id)) {
				msg.member.removeRole(player);
				msg.react(get_confirm_react());
			} else {
				msg.react(get_error_react());
			}
		}
	}),
	kickall: new Command((msg, args, channel) => {
		if (!setup && has_perms(msg.member)) {
			let player = get_player_role(channel.guild);
			if (msg.member.roles.find(x => x.id === player.id)) {
				msg.member.removeRole(player);
				msg.react(get_confirm_react());
			} else {
				msg.react(get_error_react());
			}
		}
	}),
	cleanup: new Command((msg, args, channel) => {
		set_setup(null);
		set_can_speak(channel, null, true);
		clear_member_overwrites(get_secret_channel(channel.guild));
	}),
	setupcustom: new Command((msg, args, channel) => {
		let player_roles = [];
		let opt = [];
		let error_roles = new Set();
		for (let arg of args) {
			if (arg.match(/^\[.*?\](x[0-9]+)?$/)) {
				let alts = arg.substring(1, arg.indexOf("]")).split("/");
				let idx = arg.indexOf("]x");
				let count = idx !== -1 ? parseInt(arg.substr(idx + 2)) : 1;
				let altsr = [];
				for (let role of alts) {
					if (role in roles) {
						altsr.push(roles[role]);
					} else {
						error_roles.add(role);
					}
				}
				for (let i = 0; i < count; i++) {
					player_roles.push(altsr);
				}
			} else if (arg[0] === "-") {
				opt.push(arg.substr(1));
			}
		}
		if (error_roles.size === 0) {
			let mafia_role = get_player_role(channel.guild);
			let members = channel.members.array().filter(x => x.roles.find(r => r.id === mafia_role.id) != undefined);
			console.log("players " + player_roles.length);
			if (members.length === player_roles.length) {
				let setup = new Setup("<" + args.join(" ") + ">", player_roles, opt, setups.Classic.define);
				let players: Player[] = [];
				let inst = setup.instance(channel, players);
				set_setup(inst);
				for (let i = 0; i < members.length; i++) {
					players.push(new Player(inst, i + 1, members[i], random_in(player_roles[i])));
				}
				signing_up = false;
				inst.start();
			} else {
				msg.reply("Not enough players. You need " + player_roles.length + ", but there are " + members.length + ".")
			}
		} else {
			msg.reply("Roles not found: " + [...error_roles].join(", "));
		}
	})
};