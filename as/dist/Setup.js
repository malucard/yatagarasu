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
function create_setup(name, player_roles, opt, code) {
    exports.setups[name] = new Setup(name, player_roles, opt, new Function(code));
}
exports.create_setup = create_setup;
class SetupInstance extends Env_1.default {
    constructor(channel, players, setup) {
        super(); //setup.name, setup.count, setup.define);
        this.name = setup.name;
        this.players = players;
        this.player_roles = setup.player_roles;
        this.opt = setup.opt;
        this.channel = channel;
        this.secret_channel = db_1.get_secret_channel(channel.guild);
        this.mafia_player = db_1.get_player_role(channel.guild);
        this.isDay = false;
        this.turn = 1;
        if (exports.setups.Classic) {
            exports.setups.Classic.define.call(this);
        }
        setup.define.call(this);
    }
    fmt(str) {
        return str.replace(/%t/g, this.turn.toString()).replace(/%players/g, this.players.map(x => x.number + "- " + x.name).join("\n"));
    }
}
exports.SetupInstance = SetupInstance;
//# sourceMappingURL=Setup.js.map