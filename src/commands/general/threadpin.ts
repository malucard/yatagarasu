import * as Discord from "discord.js";
import {
	CmdKind,
	CombinedMessageContextCommand,
	hiddenReply,
} from "../../utils/helpers";

const USER_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.SendMessagesInThreads |
	Discord.PermissionFlagsBits.CreatePublicThreads;
const BOT_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.SendMessagesInThreads |
	Discord.PermissionFlagsBits.ManageMessages;

export const threadpinCommands: CombinedMessageContextCommand[] = [
	{
		name: "Pin/Unpin (for Thread Owner)",
		type: Discord.ApplicationCommandType.Message,
		kind: CmdKind.MESSAGE_CONTEXT,
		action: async interaction => {
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
			// get data
			const message = interaction.targetMessage as Discord.Message;
			await message.channel.fetch();
			if (!message.channel.isThread()) {
				hiddenReply(interaction, "This can only be used in threads");
				return;
			} else if (!message.pinnable) {
				hiddenReply(interaction, "This message is not pinnable");
				return;
			}
			const thread = message.channel;
			const owner = await thread.fetchOwner();
			const me = await guild.members.fetchMe();
			// check perms
			if (member.id !== owner?.id) {
				hiddenReply(
					interaction,
					"You are not the owner of the thread. If you are a mod, please use the normal pin operation"
				);
				return;
			}
			if (!member.permissionsIn(thread).has(USER_PERMS)) {
				hiddenReply(
					interaction,
					"You do not have valid perms to use this"
				);
				return;
			}
			if (!me.permissionsIn(thread).has(BOT_PERMS)) {
				hiddenReply(
					interaction,
					"Bot does not have valid perms to pin"
				);
				return;
			}
			// check for locked thread
			if (thread.archived && thread.unarchivable) {
				await thread.setArchived(false);
			} else if (thread.archived) {
				hiddenReply(
					interaction,
					"Cannot unarchive thread. Please unarchive it with a mod"
				);
				return;
			}

			// perform pin or unpin
			const reply = `Message ${
				message.pinned ? "unpinned" : "pinned"
			}. Link to message: ${message.url}`;
			await (message.pinned ? message.unpin() : message.pin());
			interaction.reply(reply);
		},
	},
];
