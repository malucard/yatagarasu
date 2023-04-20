import Discord from "discord.js";
import { CmdKind, CombinedSlashCommand, hiddenReply, isInvalidMoveTarget, move_channel } from "../../utils/helpers";

const BOT_CHANNEL_PERMS = Discord.PermissionFlagsBits.SendMessages | Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.ManageRoles;
const BOT_CATEGORY_PERMS = Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.ManageRoles;
const USER_PERMS = Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.ManageChannels;
const LP_LIST_PERMS = Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.SendMessages;

export const archivelpCommands: CombinedSlashCommand[] = [
	{
		name: "archivelp",
		description: "Archives the given LP into the supplied category.",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "category",
				description: "Category to archive the channel to.",
				required: true,
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildCategory]
			},
			{
				name: "channel",
				description: "Channel to archive, defaults to current channel.",
				required: false,
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText]
			},
		],
		action: async (interaction) => {
			const user = interaction.user;
			const guild = interaction.guild;
			if (!guild) {
				hiddenReply(interaction, "An error occured");
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(user);
			if (!member) {
				hiddenReply(interaction, "An error occured");
				console.error("Member not found");
				return;
			}
			let channel: Discord.TextChannel;
			channel = interaction.options.getChannel("channel", false) as Discord.TextChannel;
			const category = interaction.options.getChannel("category") as Discord.CategoryChannel;
			if (!channel) {
				if (interaction.channel?.isThread()) {
					hiddenReply(interaction, "You cannot use this in a thread");
					console.error("Thread not allowed");
					return;
				}
				channel = interaction.channel as Discord.TextChannel;
			} else if (!(channel instanceof Discord.TextChannel)) {
				hiddenReply(interaction, "Not a text channel");
				console.error("Not a text channel");
				return;
			}
			const me = await guild.members.fetchMe();
			if (!me?.permissionsIn(channel).has(BOT_CHANNEL_PERMS) ||
				!me?.permissionsIn(category).has(BOT_CATEGORY_PERMS)) {
				handle_no_bot_perms(interaction, guild, channel, category);
				return;
			}
			else if (member.permissionsIn(channel).has(USER_PERMS) &&
				member.permissionsIn(category).has(USER_PERMS)
			) {
				const textChannel = channel as Discord.TextChannel;
				await textChannel.permissionOverwrites.edit(guild.roles.everyone, {
					AddReactions: false,
					SendMessages: false,
					SendMessagesInThreads: false,
				});
				textChannel.permissionOverwrites.cache.forEach(permOverwrite =>
					permOverwrite.type === Discord.OverwriteType.Member &&
					permOverwrite.edit({
						ManageMessages: null
					})
				);
				move_channel(
					textChannel,
					category,
					() => {
						handle_reply(interaction, "LP Archived", guild, `<#${textChannel.id}> archived by <@${member.id}>`);
					},
					() => {
						hiddenReply(interaction, "Move failed, is category full?");
					}
				);
			} else {
				hiddenReply(interaction, "You do not have valid perms");
				console.error(member.permissionsIn(channel).toJSON());
				console.error(member.permissionsIn(category).toJSON());
			}
			return;
		}
	}, {
		name: "unarchivelp",
		description: "Unarchives the LP and moves to a target location if given",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "channel",
				description: "Which channel to unarchive. Defaults to the current channel.",
				required: false,
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText],
			}, {
				name: "target",
				description: "Where to move to. Defaults to not moving.",
				required: false,
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText]
			}, {
				name: "lper",
				description: "LPer to restore manage messages to. Can be ignored",
				required: false,
				type: Discord.ApplicationCommandOptionType.User
			}
		],
		action: async (interaction) => {
			const user = interaction.user;
			const guild = interaction.guild;
			if (!guild) {
				hiddenReply(interaction, "An error occured");
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(user);
			if (!member) {
				hiddenReply(interaction, "An error occured");
				console.error("Member not found");
				return;
			}
			// obtain interaction options
			let channel: Discord.TextChannel;
			channel = interaction.options.getChannel("channel", false) as Discord.TextChannel;
			if (!channel) {
				if (interaction.channel?.isThread()) {
					hiddenReply(interaction, "You cannot use this in a thread");
					console.error("Thread not allowed");
					return;
				}
				channel = interaction.channel as Discord.TextChannel;
			} else if (!(channel instanceof Discord.TextChannel)) {
				hiddenReply(interaction, "Not a text channel");
				console.error("Not a text channel");
				return;
			}
			const target = interaction.options.getChannel("target", false) as Discord.TextChannel;
			const doMove = !!target; // move if target is given
			if (doMove) {
				if (target instanceof Discord.TextChannel) {
					if (isInvalidMoveTarget(channel, target)) {
						hiddenReply(interaction, "Channel already at target, run again without target to unarchive.");
						return;
					}
				} else {
					hiddenReply(interaction, "An error occured");
					console.error("Target not a Text channel");
					return;
				}
			}
			const LPer = interaction.options.getUser("lper", false);
			const doManage = !!LPer;
			if (doManage) {
				if (!guild.members.cache.has(LPer.id)) {
					hiddenReply(interaction, "An error occured");
					console.error("User does not exist in guild");
					return;
				}
			}
			// verify permissions for bot and user. should be same as archiveLP
			const category = target?.parent;
			if (target && !category) {
				hiddenReply(interaction, "Cannot use with uncategorized target channel");
				return;
			}
			const me = await guild.members.fetchMe();
			if (!me.permissionsIn(channel).has(BOT_CHANNEL_PERMS) || (category && !me?.permissionsIn(category).has(BOT_CATEGORY_PERMS))) {
				handle_no_bot_perms(interaction, guild, channel, category);
				return;
			}
			else if (member.permissionsIn(channel).has(USER_PERMS) &&
				(!category || member.permissionsIn(category).has(USER_PERMS))
			) {
				const message: string[] = [];
				// set permissions for channel
				await channel.permissionOverwrites.edit(guild.roles.everyone, {
					AddReactions: null,
					SendMessages: null,
					SendMessagesInThreads: null,
				});
				message.push("LP Unarchived");
				// set permissions for LPer, if doManage
				if (doManage) {
					await channel.permissionOverwrites.edit(LPer, {
						ManageMessages: true,
						ViewChannel: true
					});
					message.push(`${LPer.toString()} set as LPer`);
				}
				// move channel, if target given
				if (doMove) {
					move_channel(channel, target, () => {
						message.push(`Channel moved after ${target.toString()}`);
						handle_reply(interaction, message.join("\n"), guild, `<#${channel.id}> unarchived by <@${member.id}>`);
					}, () => {
						hiddenReply(interaction, "Move failed, is category full?");
					});
				} else {
					handle_reply(interaction, message.join("\n"), guild, `<#${channel.id}> unarchived by <@${member.id}>`);
				}
			} else {
				hiddenReply(interaction, "You do not have valid perms");
				console.error(member.permissionsIn(channel).toJSON());
				console.error(member.permissionsIn(category).toJSON());
			}
		}
	}
];

async function handle_reply(interaction: Discord.CommandInteraction, message: string, guild: Discord.Guild, lpListMessage: string) {
	interaction.reply(message);
	const me = await guild.members.fetchMe();
	const lpList = guild.channels.cache.find(channel => channel.name === "lp-list");
	if (lpList && lpList instanceof Discord.TextChannel && me?.permissionsIn(lpList).has(LP_LIST_PERMS)) {
		await lpList.messages.fetch();
		if (lpList.lastMessage?.member.id === me.id) {
			const oldContent = lpList.lastMessage.content;
			lpList.lastMessage.edit([oldContent, lpListMessage].join("\n\n"));
		} else {
			lpList.send(lpListMessage);
		}
	}
}

async function handle_no_bot_perms(interaction: Discord.CommandInteraction, guild: Discord.Guild, channel: Discord.TextChannel, category?: Discord.CategoryChannel) {
	let missingPerms = "";
	let missingPermsArr: string[] = [];
	const me = await guild.members.fetchMe();
	const channelPerms = me.permissionsIn(channel);
	const categoryPerms: Readonly<Discord.PermissionsBitField> = category && me.permissionsIn(category);
	if (!channelPerms.has(BOT_CHANNEL_PERMS)) {
		missingPerms += "Channel: ";
		if (!channelPerms.has(Discord.PermissionFlagsBits.SendMessages)) {
			missingPermsArr.push("Send messages");
		}
		if (!channelPerms.has(Discord.PermissionFlagsBits.ViewChannel)) {
			missingPermsArr.push("View Channel");
		}
		if (!channelPerms.has(Discord.PermissionFlagsBits.ManageRoles)) {
			missingPermsArr.push("Manage Roles");
		}
		if (missingPermsArr.length) {
			missingPerms += missingPermsArr.join(", ");
		}
		missingPerms += "\n";
	}
	missingPermsArr = [];
	if (category && !categoryPerms.has(BOT_CATEGORY_PERMS)) {
		missingPerms += "Category: ";
		if (!categoryPerms.has(Discord.PermissionFlagsBits.ViewChannel)) {
			missingPermsArr.push("View Channel");
		}
		if (!categoryPerms.has(Discord.PermissionFlagsBits.ManageRoles)) {
			missingPermsArr.push("Manage Roles");
		}
		if (missingPermsArr.length) {
			missingPerms += missingPermsArr.join(", ");
		}
		missingPerms += "\n";
	}
	hiddenReply(interaction, "Bot does not have valid perms:\n" + missingPerms);
	console.error(me?.permissionsIn(channel).toJSON());
	category && console.error(me?.permissionsIn(category).toJSON());
	return;
}