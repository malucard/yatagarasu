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
		// in same category, moving below causes an upshift, so you have to place at the same location
		if (targetCategory.id === channel.parent.id && target.position > channel.position) {
			targetPosition = target.position;
		} else {
			targetPosition = target.position + 1;
		}
	}
	channel.setParent(targetCategory, { lockPermissions: false })
		.then(channel => channel.setPosition(targetPosition)
			.then(onsuccess)
			.catch(onrejected))
		.catch(onrejected);
};

/**
 * Verifies if moving channels is valid
 * @param channel - Channel to move
 * @param targetChannel - Channel to move to
 * @returns if the move is valid to do
 */
export const isInvalidMoveTarget = (channel: Discord.TextChannel, targetChannel: Discord.TextChannel) => {
	return (targetChannel.parent.id === channel.parent.id && (targetChannel.position + 1) === channel.position) || (targetChannel.id === channel.id);
};
