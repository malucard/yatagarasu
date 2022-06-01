import Discord from "discord.js";

export const FLAGS = Discord.Permissions.FLAGS;

const hiddenReplyContent = (message: string): Discord.InteractionReplyOptions => ({ content: message, ephemeral: true });
export const hiddenReply = (interaction: Discord.CommandInteraction, message: string) => interaction.reply(hiddenReplyContent(message));

/**
 * Moves channels
 * @param channel - Channel to move
 * @param target - Channel or Category to move after
 * @param onsuccess - Callback when move succeeds
 * @param onrejected - Callback when move fails
 */
export const move_channel = (channel: Discord.TextChannel, target: Discord.TextChannel | Discord.CategoryChannel, onsuccess?: () => void, onrejected?: () => void): void => {
	// at this point it is known that perms are valid.
	let targetCategory: Discord.CategoryChannel;
	let targetPosition: number;
	if (target instanceof Discord.CategoryChannel) {
		targetCategory = target;
		targetPosition = 0;
	} else {
		const parent = target.parent;
		targetCategory = parent;
		targetPosition = target.position + 1;
	}
	channel.setParent(targetCategory, { lockPermissions: false })
		.then(channel => channel.setPosition(targetPosition)
			.then(onsuccess)
			.catch(onrejected))
		.catch(onrejected);
};