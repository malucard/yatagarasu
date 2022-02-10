"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Parser = require("discord-command-parser");
const Env_1 = __importDefault(require("./Env"));
class Role {
    constructor(name, define) {
        this.name = name;
        this.define = define;
    }
    instance(setup, player) {
        return new RoleInstance(this, setup, player);
    }
}
exports.Role = Role;
exports.roles = {
    Blue: new Role("Blue", new Function(`
		this.start = () => {
			this.player.member.send(this.fmt("You are a %r, number %n."));
		};
		this.day = () => {};
		this.night = () => {};
		this.lynch = () => {};
		this.die = (cause) => {};
		this.perform = () => {};
	`)),
    Cop: new Role("Cop", new Function(`
		let choice = null;
		this.night = () => {
			this.player.member.send(this.fmt("Night %t has begun. React with the number of who you wish to investigate.\\n%others"));
		};
		this.die = (cause) => {};
		this.perform = () => {
			if(choice == null) {
				this.get_player(choice);
				this.player.member.send("");
			}
		};
		this.dm_commands.action = (args) => {
			let n = parseInt(args[0]);
			if(n !== NaN) {
				choice = this.get_player(n);
			}
		}
	`))
};
function create_role(name, code) {
    exports.roles[name] = new Role(name, new Function(code));
}
exports.create_role = create_role;
class RoleInstance extends Env_1.default {
    constructor(role, setup, player) {
        super();
        this.name = role.name;
        this.player = player;
        this.players = setup.players;
        this.channel = setup.channel;
        this.secret_channel = setup.secret_channel;
        this.mafia_player = setup.mafia_player;
        this.setup = setup;
        this.dm_commands = {};
        exports.roles.Blue.define.call(this);
        role.define.call(this);
    }
    receive_dm(msg) {
        let parsed = Parser.parse(msg, ";");
        if (parsed.success && parsed.command in this.dm_commands) {
            this.dm_commands[parsed.command](parsed.arguments, parsed.message);
        }
    }
    others() {
        return this.players.filter(x => x.id !== this.player.id);
    }
    fmt(str) {
        return this.setup.fmt(str.replace(/%r/g, this.name).replace(/%m/g, this.player.name)
            .replace(/%n/g, this.player.number.toString()).replace(/%id/g, this.player.id)
            .replace(/%others/g, this.others().map(x => x.number + "- " + x.name).join("\n")));
    }
}
exports.RoleInstance = RoleInstance;
//# sourceMappingURL=Role.js.map