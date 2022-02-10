"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChannelManager = require("./ChannelManager");
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
}
exports.default = Env;
//# sourceMappingURL=Env.js.map