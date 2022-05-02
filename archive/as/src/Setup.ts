import Discord = require("discord.js");
import {get_player_role, get_secret_channel} from "./db";
import ChannelManager = require("./ChannelManager");
import Env from "./Env";
import {Role, roles} from "./Role";
import Player from "./Player";

export class Setup {
	name: string;
	player_roles: Role[][];
	opt: string[];
	define: Function;
	start: () => void;
	day: () => void;
	night: () => void;

	constructor(name: string, player_roles: Role[][], opt: string[], define: Function) {
		this.name = name;
		this.player_roles = player_roles;
		this.opt = opt;
		this.define = define;
	}

	instance(channel: Discord.TextChannel, players: Player[]): SetupInstance {
		return new SetupInstance(channel, players, this);
	}
}

export let setups: {[name: string]: Setup} = {
	Classic: new Setup("Classic", [[roles.Blue], [roles.Blue], [roles.Blue], [roles.Doc], [roles.Cop], [roles.Vanilla], [roles.Vanilla]], [], new Function(`
		this.start = () => {
			for(let p of this.players) {
				p.role.start();
			}
			if(this.opt.includes("daystart")) this.day();
			else this.night();
		};
		this.day = () => {
			if(this.opt.includes("daystart")) this.turn++;
			this.isDay = true;
			for(let p of this.players) {
				p.role.day();
			}
			set_can_speak(this.channel, this.mafia_player);
			this.timeouts = [
				setTimeout(() => this.channel.send("5min remaining."), 300000),
				setTimeout(() => this.channel.send("2min30s remaining."), 450000),
				setTimeout(() => this.channel.send("10s remaining."), 590000),
				this.opt.includes("nightless")? setTimeout(() => this.day(), 600000):
				setTimeout(() => this.night(), 600000)
			];
		};
		this.night = () => {
			this.isDay = false;
			for(let p of this.players) {
				p.role.night();
			}
		};
		this.commands = {
			lynch: (args, player) => {
				this.lynches[player.number] = true;
			}
		}
	`))
};

export function create_setup(name: string, player_roles: Role[][], opt: string[], code: string) {
	setups[name] = new Setup(name, player_roles, opt, new Function(code));
}

export class SetupInstance extends Env {
	name: string;
	player_roles: Role[][];
	opt: string[];
	isDay: boolean;
	turn: number;

	constructor(channel: Discord.TextChannel, players: Player[], setup: Setup) {
		super();//setup.name, setup.count, setup.define);
		this.name = setup.name;
		this.players = players;
		this.player_roles = setup.player_roles;
		this.opt = setup.opt;
		this.channel = channel;
		this.secret_channel = get_secret_channel(channel.guild);
		this.mafia_player = get_player_role(channel.guild);
		this.isDay = false;
		this.turn = 1;
		if(setups.Classic) {
			setups.Classic.define.call(this);
		}
		setup.define.call(this);
	}

	fmt(str: string): string {
		return str.replace(/%t/g, this.turn.toString()).replace(/%players/g, this.players.map(x => x.number + "- " + x.name).join("\n"));
	}
}