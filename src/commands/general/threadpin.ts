import Discord from "discord.js";
import { CombinedMessageContextCommand } from "../../bot";
import { FLAGS, hiddenReply } from "../../utils/helpers";
import { CmdKind } from "../mafia/mafia";

const USER_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.SEND_MESSAGES_IN_THREADS | FLAGS.CREATE_PUBLIC_THREADS;
const BOT_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.SEND_MESSAGES_IN_THREADS | FLAGS.MANAGE_MESSAGES;

export const threadpinCommands: CombinedMessageContextCommand[] = [{
	name: "Pin/Unpin (for Thread Owner)",
	type: "MESSAGE",
	kind: CmdKind.MESSAGE_CONTEXT,
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
		// check perms
		if (member.id !== owner.id) {
			hiddenReply(interaction, "You are not the owner of the thread. If you are a mod, please use the normal pin operation");
			return;
		}
		if (!member.permissionsIn(thread).has(USER_PERMS)) {
			hiddenReply(interaction, "You do not have valid perms to use this");
			return;
		}
		if (!guild.me.permissionsIn(thread).has(BOT_PERMS)) {
			hiddenReply(interaction, "Bot does not have valid perms to pin");
			return;
		}
		// check for locked thread
		if (thread.archived && thread.unarchivable) {
			await thread.setArchived(false);
		} else if (thread.archived) {
			hiddenReply(interaction, "Cannot unarchive thread. Please unarchive it with a mod");
			return;
		}

		// perform pin or unpin
		const wasPinned = message.pinned;
		await ((await (wasPinned ? message.unpin() : message.pin())).reply(`Message ${wasPinned ? "unpinned" : "pinned"} by ${user.toString()}`));
		hiddenReply(interaction, "Done");
	}
}];
