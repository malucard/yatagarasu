import Discord = require("discord.js");
import Parser = require("discord-command-parser");
import Env from "./Env";
import {SetupInstance} from "./Setup";
import Player from "./Player";

export class Role {
	name: string;
	define: Function;

	constructor(name: string, define: Function) {
		this.name = name;
		this.define = define;
	}

	instance(setup: SetupInstance, player: Player): RoleInstance {
		return new RoleInstance(this, setup, player);
	}
}

export let roles: {[name: string]: Role} = {
	Blue: new Role("Blue", new Function(`
		this.start = () => {
			this.player.member.send(this.fmt("You are a %r, number %n."));
		};
		this.day = () => {};
		this.night = () => {};
		this.lynch = () => {};
		this.die = (cause) => {};
		this.perform = (success) => {};
		this.get_side = () => "Village";
		this.was_hooked = false;
	`)),
	Cop: new Role("Cop", new Function(`
		let choice = null;
		this.night = () => {
			this.player.member.send(this.fmt("Night %t has begun. Reply with \`;action <number>\`, with the number of who you wish to investigate.\\n%others"));
			this.was_hooked = false;
			this.pending();
			choice = null;
		};
		this.die = (cause) => {};
		this.perform = () => {
			if(!this.was_hooked) {
				if(choice != null) {
					this.player.member.send(choice.name + " is sided with the " + choice.role.get_side() + ".");
				} else {
					this.player.member.send("The night ended. You investigated no one.");
				}
			} else {
				this.player.member.send("The night ended. Your investigation yielded no result.");
			}
		};
		this.dm_commands.action = (args, msg) => {
			let n = parseInt(args[0]);
			if(n !== NaN) {
				choice = this.get_player(n);
				if(choice && choice.id !== this.player.id) {
						msg.react(this.get_confirm_react());
					this.done();
				}
			}
		}
	`)),
	Mafioso: new Role("Mafioso", new Function(`
		let choice = null;
		this.night = () => {
			this.secret_channel.send(this.fmt("Night %t has begun. Reply with \`;action <number>\`, with the number of who you wish to investigate.\\n%others"));
			this.was_hooked = false;
			this.pending();
			choice = null;
		};
		this.die = (cause) => {};
		this.perform = () => {
			if(!this.was_hooked) {
				if(choice != null) {
					this.player.member.send(choice.name + " is sided with the " + choice.role.get_side() + ".");
				} else {
					this.player.member.send("The night ended. You investigated no one.");
				}
			} else {
				this.player.member.send("The night ended. Your investigation yielded no result.");
			}
		};
		this.dm_commands.action = (args, msg) => {
			let n = parseInt(args[0]);
			if(n !== NaN) {
				choice = this.get_player(n);
				if(choice && choice.id !== this.player.id) {
						msg.react(this.get_confirm_react());
					this.done();
				}
			}
		}
	`))
};

export function create_role(name: string, code: string) {
	roles[name] = new Role(name, new Function(code));
}

export class RoleInstance extends Env {
	name: string;
	player: Player;
	setup: SetupInstance;
	dm_commands: {[name: string]: (args: string[], msg: Discord.Message) => void} = {};
	start: () => void;
	day: () => void;
	night: () => void;
	lynch: () => void;
	die: (cause: string) => void;
	perform: (success: boolean) => void;
	failed: () => void;
	hooked: () => void;

	constructor(role: Role, setup: SetupInstance, player: Player) {
		super();
		this.name = role.name;
		this.player = player;
		this.players = setup.players;
		this.channel = setup.channel;
		this.secret_channel = setup.secret_channel;
		this.mafia_player = setup.mafia_player;
		this.setup = setup;
		this.dm_commands = {};
		roles.Blue.define.call(this);
		role.define.call(this);
	}

	receive_dm(msg: Discord.Message) {
		let parsed = Parser.parse(msg, ";");
		if(parsed.success && parsed.command in this.dm_commands) {
			this.dm_commands[parsed.command](parsed.arguments, parsed.message);
		}
	}
	
	others(): Player[] {
		return this.players.filter(x => x.id !== this.player.id);
	}

	fmt(str: string): string {
		return this.setup.fmt(str.replace(/%r/g, this.name).replace(/%m/g, this.player.name)
		.replace(/%n/g, this.player.number.toString()).replace(/%id/g, this.player.id)
		.replace(/%others/g, this.others().map(x => x.number + "- " + x.name).join("\n")));
	}
}