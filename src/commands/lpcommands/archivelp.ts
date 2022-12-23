import Discord from "discord.js";
import { ApplicationCommandOptionTypes, ChannelTypes } from "discord.js/typings/enums";
import { CombinedApplicationCommand } from "../../bot";
import { FLAGS, hiddenReply, isInvalidMoveTarget, move_channel } from "../../utils/helpers";

const BOT_CHANNEL_PERMS = FLAGS.SEND_MESSAGES | FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_ROLES;
const BOT_CATEGORY_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_ROLES;
const USER_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_CHANNELS;
const LP_LIST_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES;

export const archivelpCommands: CombinedApplicationCommand[] = [
	{
		name: "archivelp",
		description: "Archives the given LP into the supplied category.",
		options: [
			{
				name: "category",
				description: "Category to archive the channel to.",
				required: true,
				type: ApplicationCommandOptionTypes.CHANNEL,
				channelTypes: [ChannelTypes.GUILD_CATEGORY]
			},
			{
				name: "channel",
				description: "Channel to archive, defaults to current channel.",
				required: false,
				type: ApplicationCommandOptionTypes.CHANNEL,
				channelTypes: [ChannelTypes.GUILD_TEXT]
			},
		],
		action: async (interaction: Discord.CommandInteraction) => {
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
			if (!guild.me?.permissionsIn(channel).has(BOT_CHANNEL_PERMS) ||
				!guild.me?.permissionsIn(category).has(BOT_CATEGORY_PERMS)) {
				handle_no_bot_perms(interaction, guild, channel, category);
				return;
			}
			else if (member.permissionsIn(channel).has(USER_PERMS) &&
				member.permissionsIn(category).has(USER_PERMS)
			) {
				const textChannel = channel as Discord.TextChannel;
				await textChannel.permissionOverwrites.edit(guild.roles.everyone, {
					ADD_REACTIONS: false,
					SEND_MESSAGES: false,
					SEND_MESSAGES_IN_THREADS: false,
				});
				textChannel.permissionOverwrites.cache.forEach(permOverwrite =>
					permOverwrite.type === "member" &&
					permOverwrite.edit({
						MANAGE_MESSAGES: null
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
		options: [
			{
				name: "channel",
				description: "Which channel to unarchive. Defaults to the current channel.",
				required: false,
				type: ApplicationCommandOptionTypes.CHANNEL,
				channelTypes: [ChannelTypes.GUILD_TEXT],
			}, {
				name: "target",
				description: "Where to move to. Defaults to not moving.",
				required: false,
				type: ApplicationCommandOptionTypes.CHANNEL,
				channelTypes: [ChannelTypes.GUILD_TEXT]
			}, {
				name: "lper",
				description: "LPer to restore manage messages to. Can be ignored",
				required: false,
				type: ApplicationCommandOptionTypes.USER
			}
		],
		action: async (interaction: Discord.CommandInteraction) => {
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
			if (!guild.me.permissionsIn(channel).has(BOT_CHANNEL_PERMS) || (category && !guild.me?.permissionsIn(category).has(BOT_CATEGORY_PERMS))) {
				handle_no_bot_perms(interaction, guild, channel, category);
				return;
			}
			else if (member.permissionsIn(channel).has(USER_PERMS) &&
				(!category || member.permissionsIn(category).has(USER_PERMS))
			) {
				const message: string[] = [];
				// set permissions for channel
				await channel.permissionOverwrites.edit(guild.roles.everyone, {
					ADD_REACTIONS: null,
					SEND_MESSAGES: null,
					SEND_MESSAGES_IN_THREADS: null,
				});
				message.push("LP Unarchived");
				// set permissions for LPer, if doManage
				if (doManage) {
					await channel.permissionOverwrites.edit(LPer, {
						MANAGE_MESSAGES: true,
						VIEW_CHANNEL: true
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
	const lpList = guild.channels.cache.find(channel => channel.name === "lp-list");
	if (lpList && lpList instanceof Discord.TextChannel && guild.me?.permissionsIn(lpList).has(LP_LIST_PERMS)) {
		await lpList.messages.fetch();
		if (lpList.lastMessage?.member.id === guild.me.id) {
			const oldContent = lpList.lastMessage.content;
			lpList.lastMessage.edit([oldContent, lpListMessage].join("\n\n"));
		} else {
			lpList.send(lpListMessage);
		}
	}
}

function handle_no_bot_perms(interaction: Discord.CommandInteraction, guild: Discord.Guild, channel: Discord.TextChannel, category?: Discord.CategoryChannel) {
	let missingPerms = "";
	let missingPermsArr: string[] = [];
	const channelPerms = guild.me.permissionsIn(channel);
	const categoryPerms: Readonly<Discord.Permissions> = category && guild.me.permissionsIn(category);
	if (!channelPerms.has(BOT_CHANNEL_PERMS)) {
		missingPerms += "Channel: ";
		if (!channelPerms.has(FLAGS.SEND_MESSAGES)) {
			missingPermsArr.push("Send messages");
		}
		if (!channelPerms.has(FLAGS.VIEW_CHANNEL)) {
			missingPermsArr.push("View Channel");
		}
		if (!channelPerms.has(FLAGS.MANAGE_ROLES)) {
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
		if (!categoryPerms.has(FLAGS.VIEW_CHANNEL)) {
			missingPermsArr.push("View Channel");
		}
		if (!categoryPerms.has(FLAGS.MANAGE_ROLES)) {
			missingPermsArr.push("Manage Roles");
		}
		if (missingPermsArr.length) {
			missingPerms += missingPermsArr.join(", ");
		}
		missingPerms += "\n";
	}
	hiddenReply(interaction, "Bot does not have valid perms:\n" + missingPerms);
	console.error(guild.me?.permissionsIn(channel).toJSON());
	category && console.error(guild.me?.permissionsIn(category).toJSON());
	return;
}