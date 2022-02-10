"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const Env_1 = __importDefault(require("./Env"));
const Role_1 = require("./Role");
class Setup {
    constructor(name, player_roles, opt, define) {
        this.name = name;
        this.player_roles = player_roles;
        this.opt = opt;
        this.define = define;
    }
    instance(channel, players) {
        return new SetupInstance(channel, players, this);
    }
}
exports.Setup = Setup;
exports.setups = {
    Classic: new Setup("Classic", [[Role_1.roles.Blue], [Role_1.roles.Blue], [Role_1.roles.Blue], [Role_1.roles.Doc], [Role_1.roles.Cop], [Role_1.roles.Vanilla], [Role_1.roles.Vanilla]], [], new Function(`
		this.start = () => {
			for(let p of this.players) {
				p.role.start();
			}
			if(this.opt.includes("daystart") || this.opt.includes("nightless")) this.day();
			else this.night();
		};
		let timeouts;
		this.list_lynch = (channel) => {
			let text = "";
			let consensus = null;
			let c_votes = 0;
			let votes = {};
			for(let [p, t] of Object.entries(lynches)) {
				let target = this.get_player(t);
				text += this.get_player(p).name + " votes to lynch " + (target? target.name: "nobody") + ".\\n";
				if(t in votes) votes[t]++;
				else votes[t] = 1;
			}
			for(let [t, count] of Object.entries(votes)) {
				let target = this.get_player(t);
				if(count > c_votes) {
					consensus = target;
					c_votes = count;
				} else if(count == c_votes) {
					consensus = null;
				}
			}
			channel.send(text + "**The consensus is to lynch " + (consensus !== null? consensus.name: "nobody") + ".**");
			return consensus;
		}
		this.end_day = () => {
			for(let t of timeouts) {
				clearTimeout(t);
			}
			timeouts = null;
			let lynched = this.list_lynch(this.channel);
			this.kill(lynched);
			if(this.opt.includes("nightless")) this.day();
			else this.night();
		}
		this.day = () => {
			if(this.opt.includes("daystart")) this.turn++;
			this.isDay = true;
			lynches = {};
			this.channel.send(this.fmt("Day %t has begun. Vote who to lynch with \`;lynch <ping>\`."));
			for(let p of this.players) {
				p.role.day();
			}
			this.set_can_speak(this.channel, this.mafia_player, true);
			timeouts = [
				setTimeout(() => this.channel.send("5min remaining."), 300000),
				setTimeout(() => this.channel.send("2min30s remaining."), 450000),
				setTimeout(() => this.channel.send("10s remaining."), 590000),
				setTimeout(() => this.end_day(), 600000)
			];
		};
		let night;
		let pending = 0;
		let lynches = {};
		this.night = () => {
			if(!this.opt.includes("daystart")) this.turn++;
			this.channel.send(this.fmt("Night %t has begun. Power roles, please do your actions on DM, and mafia, check the secret chat."));
			this.set_can_speak(this.channel, this.mafia_player, false);
			this.isDay = false;
			for(let p of this.players) {
				p.role.pending = () => {
					pending++;
					p.isDone = false;
				};
				p.role.done = () => {
					pending--;
					p.isDone = true;
					if(pending == 0) {
						clearTimeout(night);
						for(let p of this.players) {
							p.role.perform();
						}
						if(this.opt.includes("dayless")) this.night();
						else this.day();
					}
				};
				p.role.night();
			}
			if(pending == 0) {
				for(let p of this.players) {
					p.isDone = true;
					p.role.perform();
				}
				if(this.opt.includes("dayless")) this.night();
				else this.day();
			} else {
				night = setTimeout(() => {
					for(let p of this.players) {
						p.role.perform();
						p.isDone = true;
					}
					pending = 0;
					if(this.opt.includes("dayless")) this.night();
					else this.day();
				}, 420000);
			}
		};
		this.commands.lynch = (args, player, msg) => {
			if(args.length > 0 && args[0].match(/^<@!?[0-9]{18}>$/)) {
				let target = this.get_player(args[0].substr(args[0].startsWith("<@!")? 3: 2, 18));
				if(target) {
					lynches[player.id] = target.id;
					msg.react(this.get_confirm_react());
					let missing = false;
					for(let p of this.players) {
						if(!(p.id in lynches)) {
							missing = true;
							break;
						}
					}
					if(!missing) {
						this.end_day();
					}
				}
			} else {
				lynches[player.id] = null;
			}
		};
		this.commands.listlynch = (args, player, msg) => {
			this.list_lynch(msg.channel);
		};
	`))
};
function create_setup(name, player_roles, opt, code) {
    exports.setups[name] = new Setup(name, player_roles, opt, new Function(code));
}
exports.create_setup = create_setup;
class SetupInstance extends Env_1.default {
    constructor(channel, players, setup) {
        super();
        this.commands = {};
        this.dm_commands = {};
        this.name = setup.name;
        this.players = players;
        this.player_roles = setup.player_roles;
        this.opt = setup.opt;
        this.channel = channel;
        this.secret_channel = db_1.get_secret_channel(channel.guild);
        this.mafia_player = db_1.get_player_role(channel.guild);
        this.isDay = false;
        this.turn = 0;
        if (exports.setups.Classic) {
            exports.setups.Classic.define.call(this);
        }
        setup.define.call(this);
    }
    kill(player) {
        player.role.die("lynch");
        this.players = this.players.filter(x => x !== player);
    }
    fmt(str) {
        return str.replace(/%t/g, this.turn.toString()).replace(/%players/g, this.players.map(x => x.number + "- " + x.name).join("\n"));
    }
}
exports.SetupInstance = SetupInstance;
//# sourceMappingURL=Setup.js.map