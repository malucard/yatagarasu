import * as Discord from "discord.js";
import {
	CmdKind,
	CombinedSlashCommand,
	hiddenReply,
	isInvalidMoveTarget,
	moveChannelPromise,
} from "../../utils/helpers";

const CHANNEL_PERMS =
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages;
const CATEGORY_PERMS =
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ViewChannel;

export const moveCommands: CombinedSlashCommand[] = [
	{
		name: "movechannel",
		description:
			"move a channel into another place, relative to a category or another channel",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "target",
				description: "Channel / Category to move relative to.",
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [
					Discord.ChannelType.GuildText,
					Discord.ChannelType.GuildCategory,
				],
				required: true,
			},
			{
				name: "channel",
				description: "Channel to use, defaults to current channel.",
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText],
				required: false,
			},
		],
		action: async interaction => {
			const member = interaction.member;
			const usedChannel = interaction.channel;
			const me = await interaction.guild?.members.fetchMe();
			if (!me) {
				hiddenReply(interaction, "Bot not found in guild.");
				return;
			}

			const givenChannel = interaction.options.getChannel(
				"channel",
				false
			);
			const targetChannel = interaction.options.getChannel(
				"target",
				true
			);

			let channel: Discord.TextChannel | null = null;
			if (usedChannel instanceof Discord.TextChannel) {
				channel = usedChannel;
			}
			if (givenChannel instanceof Discord.TextChannel) {
				channel = givenChannel;
			}
			if (!channel || !(member instanceof Discord.GuildMember)) {
				hiddenReply(
					interaction,
					"Invalid channel provided or used in a thread without providing a channel."
				);
				return;
			}
			if (!channel.permissionsFor(member).has(CHANNEL_PERMS)) {
				hiddenReply(
					interaction,
					"You do not have valid perms to perform this action"
				);
				return;
			} else if (!channel.permissionsFor(me).has(CHANNEL_PERMS)) {
				hiddenReply(
					interaction,
					"Bot does not have valid perms for the channel."
				);
				return;
			}
			let parent: Discord.CategoryChannel | null = null;
			if (
				!(
					targetChannel instanceof Discord.TextChannel ||
					targetChannel instanceof Discord.CategoryChannel
				)
			) {
				hiddenReply(interaction, "Invalid target channel");
				return;
			}
			if (targetChannel instanceof Discord.TextChannel) {
				// same category, one place after or same channel
				if (isInvalidMoveTarget(channel, targetChannel)) {
					hiddenReply(interaction, "Channel already at target");
					return;
				}
				parent = targetChannel.parent;
			} else {
				parent = targetChannel;
			}
			if (!parent) {
				hiddenReply(
					interaction,
					"Uncategorized channels are not supported"
				);
				return;
			}
			if (!parent.permissionsFor(member).has(CATEGORY_PERMS)) {
				hiddenReply(
					interaction,
					"You do not have valid perms for the category."
				);
			} else if (!parent.permissionsFor(me).has(CATEGORY_PERMS)) {
				hiddenReply(
					interaction,
					"Bot does not have valid perms for the category"
				);
			} else {
				moveChannelPromise(channel, targetChannel).then(
					() => {
						interaction.reply(
							`${channel?.toString()} - (${
								channel?.name
							}) moved after ${targetChannel.toString()} - (${
								targetChannel.name
							}).`
						);
					},
					() => {
						hiddenReply(
							interaction,
							"Move failed, is the category full?"
						);
					}
				);
			}
		},
	},
];
