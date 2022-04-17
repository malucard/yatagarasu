"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = exports.Command = void 0;
const db_1 = require("./db");
const ChannelManager_1 = require("./ChannelManager");
const Setup_1 = require("./Setup");
const Role_1 = require("./Role");
const Player_1 = __importDefault(require("./Player"));
const bot_1 = require("./bot");
class Command {
    constructor(run) {
        this.run = run;
    }
}
exports.Command = Command;
let signing_up = true;
exports.commands = {
    reloaddb: new Command((msg) => {
        msg.react((0, db_1.get_confirm_react)());
        (0, db_1.init_db)();
    }),
    startsignup: new Command((msg, args, channel) => {
        if (!bot_1.setup && (0, db_1.has_perms)(msg.member)) {
            msg.react((0, db_1.get_confirm_react)());
            signing_up = true;
        }
    }),
    stopsignup: new Command((msg, args, channel) => {
        if (!bot_1.setup && (0, db_1.has_perms)(msg.member)) {
            msg.react((0, db_1.get_confirm_react)());
            signing_up = false;
        }
    }),
    signup: new Command((msg, args, channel) => {
        if (signing_up) {
            msg.member.addRole((0, db_1.get_player_role)(channel.guild));
            msg.react((0, db_1.get_confirm_react)());
        }
        else {
            msg.react((0, db_1.get_error_react)());
        }
    }),
    signout: new Command((msg, args, channel) => {
        if (!bot_1.setup) {
            msg.member.removeRole((0, db_1.get_player_role)(channel.guild));
            msg.react((0, db_1.get_confirm_react)());
        }
    }),
    kick: new Command((msg, args, channel) => {
        if (args[1] && args[1].match(/^<@!?[0-9]{16,18}>$/) && (0, db_1.has_perms)(msg.member)) {
            let player = (0, db_1.get_player_role)(channel.guild);
            if (msg.member.roles.find(x => x.id === player.id)) {
                msg.member.removeRole(player);
                msg.react((0, db_1.get_confirm_react)());
            }
            else {
                msg.react((0, db_1.get_error_react)());
            }
        }
    }),
    kickall: new Command((msg, args, channel) => {
        if (!bot_1.setup && (0, db_1.has_perms)(msg.member)) {
            let player = (0, db_1.get_player_role)(channel.guild);
            if (msg.member.roles.find(x => x.id === player.id)) {
                msg.member.removeRole(player);
                msg.react((0, db_1.get_confirm_react)());
            }
            else {
                msg.react((0, db_1.get_error_react)());
            }
        }
    }),
    cleanup: new Command((msg, args, channel) => {
        (0, bot_1.set_setup)(null);
        (0, ChannelManager_1.set_can_speak)(channel, null, true);
        (0, ChannelManager_1.clear_member_overwrites)((0, db_1.get_secret_channel)(channel.guild));
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
                    if (role in Role_1.roles) {
                        altsr.push(Role_1.roles[role]);
                    }
                    else {
                        error_roles.add(role);
                    }
                }
                for (let i = 0; i < count; i++) {
                    player_roles.push(altsr);
                }
            }
            else if (arg[0] === "-") {
                opt.push(arg.substr(1));
            }
        }
        if (error_roles.size === 0) {
            let mafia_role = (0, db_1.get_player_role)(channel.guild);
            let members = channel.members.array().filter(x => x.roles.find(r => r.id === mafia_role.id) != undefined);
            console.log("players " + player_roles.length);
            if (members.length === player_roles.length) {
                let setup = new Setup_1.Setup("<" + args.join(" ") + ">", player_roles, opt, Setup_1.setups.Classic.define);
                let players = [];
                let inst = setup.instance(channel, players);
                (0, bot_1.set_setup)(inst);
                for (let i = 0; i < members.length; i++) {
                    players.push(new Player_1.default(inst, i + 1, members[i], (0, db_1.random_in)(player_roles[i])));
                }
                signing_up = false;
                inst.start();
            }
            else {
                msg.reply("Not enough players. You need " + player_roles.length + ", but there are " + members.length + ".");
            }
        }
        else {
            msg.reply("Roles not found: " + [...error_roles].join(", "));
        }
    })
};
//# sourceMappingURL=Command.js.map