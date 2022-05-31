import Discord from "discord.js";
import { CombinedApplicationCommand } from "../../bot";
import { FLAGS, hiddenReply, move_channel } from "../../utils/helpers";

const CHANNEL_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES;
const CATEGORY_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.VIEW_CHANNEL;

export const moveCommands: CombinedApplicationCommand[] = [{
	name: "movechannel",
	description: "move a channel into another place, relative to a category or another channel",
	options: [
		{
			name: "target",
			description: "Channel / Category to move relative to.",
			type: "CHANNEL",
			channelTypes: ["GUILD_CATEGORY", "GUILD_TEXT"],
			required: true
		}, {
			name: "channel",
			description: "Channel to use, defaults to current channel.",
			type: "CHANNEL",
			channelTypes: ["GUILD_TEXT"],
			required: false
		}
	],
	action: async interaction => {
		const member = interaction.member;
		const usedChannel = interaction.channel;
		const me = interaction.guild.me;

		const givenChannel = interaction.options.getChannel("channel", false);
		const targetChannel = interaction.options.getChannel("target");

		let channel: Discord.TextChannel = null;
		if (usedChannel instanceof Discord.TextChannel) {
			channel = usedChannel;
		}
		if (givenChannel instanceof Discord.TextChannel) {
			channel = givenChannel;
		}
		if (channel && member instanceof Discord.GuildMember) {
			if (!channel.permissionsFor(member).has(CHANNEL_PERMS)) {
				hiddenReply(interaction, "You do not have valid perms to perform this action");
			}
			else if (!channel.permissionsFor(me).has(CHANNEL_PERMS)) {
				hiddenReply(interaction, "Bot does not have valid perms for the channel.");
			} else {
				let parent: Discord.CategoryChannel;
				if (targetChannel instanceof Discord.TextChannel || targetChannel instanceof Discord.CategoryChannel) {
					if (targetChannel instanceof Discord.TextChannel) {
						parent = targetChannel.parent;
					} else {
						parent = targetChannel;
					}
					if (!parent.permissionsFor(member).has(CATEGORY_PERMS)) {
						hiddenReply(interaction, "You do not have valid perms for the category.");
					} else if (!parent.permissionsFor(me).has(CATEGORY_PERMS)) {
						hiddenReply(interaction, "Bot does not have valid perms for the category");
					} else {
						const success = await move_channel(channel, targetChannel);
						if (success) {
							interaction.reply(`${channel.toString()} moved.`);
						} else {
							hiddenReply(interaction, "Move failed, is the category full?");
						}
					}
				}
			}
		} else {
			hiddenReply(interaction, "Invalid channel provided or used in a thread without providing a channel.");
		}
	}
}];