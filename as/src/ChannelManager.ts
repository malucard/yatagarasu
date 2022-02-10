import Discord = require("discord.js");

export function get_everyone(guild: Discord.Guild) {
	return guild.roles.find((x) => x.name === "@everyone");
}

export function set_can_speak(channel: Discord.TextChannel, member: Discord.GuildMember | Discord.Role, can: boolean) {
	channel.overwritePermissions(member || get_everyone(channel.guild), {SEND_MESSAGES: can, ADD_REACTIONS: can});
}

export function set_can_see(channel: Discord.TextChannel, member: Discord.GuildMember | Discord.Role, can: boolean) {
	channel.overwritePermissions(member || get_everyone(channel.guild), {VIEW_CHANNEL: can});
}

export function clear_member_overwrites(channel: Discord.TextChannel) {
	for(let overwrites of channel.permissionOverwrites.values()) {
		if(overwrites.type === "member") {
			overwrites.delete();
		}
	}
}