import Discord from "discord.js";
import { ApplicationCommandOptionTypes, ChannelTypes } from "discord.js/typings/enums";
import { CombinedApplicationCommand } from "../../bot";
import { FLAGS, hiddenReply } from "../../utils/helpers";

const BOT_CHANNEL_PERMS = FLAGS.SEND_MESSAGES | FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_ROLES;
const BOT_CATEGORY_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_ROLES;
const USER_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.MANAGE_CHANNELS;
const LP_LIST_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES;

export const archivelpCommands: CombinedApplicationCommand[] = [{
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
		console.log("archivelp called");
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
			if (guild.me) {
				let missingPerms = "";
				let missingPermsArr: string[] = [];
				const channelPerms = guild.me.permissionsIn(channel);
				const categoryPerms = guild.me.permissionsIn(category);
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
				if (!categoryPerms.has(BOT_CATEGORY_PERMS)) {
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
			} else {
				hiddenReply(interaction, "Bot does not exist in guild (what)");
			}
			console.error(guild.me?.permissionsIn(channel).toJSON());
			console.error(guild.me?.permissionsIn(category).toJSON());
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
			textChannel.setParent(category, { lockPermissions: false }).then(() => {
				textChannel.setPosition(0);
				interaction.reply("LP Archived");
				const lpList = guild.channels.cache.find(channel => channel.name === "lp-list");
				if (lpList && lpList instanceof Discord.TextChannel && guild.me?.permissionsIn(lpList).has(LP_LIST_PERMS)) {
					lpList.send(`<#${textChannel.id}> archived by <@${member.id}>`);
				}
			}).catch(reason => {
				console.error(reason);
				hiddenReply(interaction, "Archive failed, is category full?");
			});
		} else {
			hiddenReply(interaction, "You do not have valid perms");
			console.error(member.permissionsIn(channel).toJSON());
			console.error(member.permissionsIn(category).toJSON());
		}
		return;
	}
}];