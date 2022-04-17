"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChannelManager = require("./ChannelManager");
const db_1 = require("./db");
class Env {
    set_can_speak(channel, member, can) {
        ChannelManager.set_can_speak(channel, member, can);
    }
    set_can_see(channel, member, can) {
        ChannelManager.set_can_see(channel, member, can);
    }
    clear_member_overwrites(channel) {
        ChannelManager.clear_member_overwrites(channel);
    }
    get_confirm_react() {
        return (0, db_1.get_confirm_react)();
    }
    get_error_react() {
        return (0, db_1.get_error_react)();
    }
    get_player(n) {
        return typeof n === "string" ? this.players.find(x => x.id === n) : this.players.find(x => x.number === n);
    }
}
exports.default = Env;
//# sourceMappingURL=Env.js.map