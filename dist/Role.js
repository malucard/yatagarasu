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
function create_role(name, code) {
    exports.roles[name] = new Role(name, new Function(code));
}
exports.create_role = create_role;
class RoleInstance extends Env_1.default {
    constructor(role, setup, player) {
        super();
        this.dm_commands = {};
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