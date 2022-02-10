"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function get_everyone(guild) {
    return guild.roles.find((x) => x.name === "@everyone");
}
exports.get_everyone = get_everyone;
function set_can_speak(channel, member, can) {
    channel.overwritePermissions(member || get_everyone(channel.guild), { SEND_MESSAGES: can, ADD_REACTIONS: can });
}
exports.set_can_speak = set_can_speak;
function set_can_see(channel, member, can) {
    channel.overwritePermissions(member || get_everyone(channel.guild), { VIEW_CHANNEL: can });
}
exports.set_can_see = set_can_see;
function clear_member_overwrites(channel) {
    for (let overwrites of channel.permissionOverwrites.values()) {
        if (overwrites.type === "member") {
            overwrites.delete();
        }
    }
}
exports.clear_member_overwrites = clear_member_overwrites;
//# sourceMappingURL=ChannelManager.js.map