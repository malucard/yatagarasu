import * as Discord from "discord.js";

export enum CmdKind {
	TEXT_OR_SLASH,
	TEXT,
	SLASH,
	MESSAGE_CONTEXT,
}

export interface CombinedSlashCommand
	extends Discord.ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: Discord.ApplicationCommandOptionData[];
	defaultPermission?: boolean;
	kind: CmdKind.SLASH;
	action?: (interaction: Discord.ChatInputCommandInteraction) => unknown;
}

export interface CombinedMessageContextCommand
	extends Discord.MessageApplicationCommandData {
	type: Discord.ApplicationCommandType.Message;
	name: string;
	kind: CmdKind.MESSAGE_CONTEXT;
	action?: (
		interaction: Discord.MessageContextMenuCommandInteraction
	) => unknown;
}

export type CombinedApplicationCommand =
	| CombinedSlashCommand
	| CombinedMessageContextCommand;

const hiddenReplyContent = (
	message: string
): Discord.InteractionReplyOptions => ({ content: message, ephemeral: true });
export const hiddenReply = (
	interaction: Discord.CommandInteraction,
	message: string
) => interaction.reply(hiddenReplyContent(message));

/**
 * Moves channels
 * @param channel - Channel to move
 * @param target - Channel or Category to move after
 * @param onsuccess - Callback when move succeeds
 * @param onrejected - Callback when move fails
 */
export const move_channel = (
	channel: Discord.TextChannel,
	target: Discord.TextChannel | Discord.CategoryChannel,
	onsuccess?: () => void,
	onrejected?: () => void
): void => {
	// at this point it is known that perms are valid.
	let targetCategory: Discord.CategoryChannel | null;
	let targetPosition: number;
	if (target instanceof Discord.CategoryChannel) {
		targetCategory = target;
		targetPosition = 0;
	} else {
		const parent = target.parent;
		targetCategory = parent;
		// in same category, moving below causes an upshift, so you have to place at the same location
		if (
			targetCategory?.id === channel.parent?.id &&
			target.position > channel.position
		) {
			targetPosition = target.position;
		} else {
			targetPosition = target.position + 1;
		}
	}
	channel
		.setParent(targetCategory, { lockPermissions: false })
		.then(channel =>
			channel
				.setPosition(targetPosition)
				.then(onsuccess)
				.catch(onrejected)
		)
		.catch(onrejected);
};

export async function moveChannelPromise(
	channel: Discord.TextChannel,
	target: Discord.TextChannel | Discord.CategoryChannel
): Promise<void> {
	return new Promise((resolve, reject) => {
		move_channel(channel, target, resolve, reject);
	});
}

/**
 * Verifies if moving channels is valid
 * @param channel - Channel to move
 * @param targetChannel - Channel to move to
 * @returns if the move is valid to do
 */
export const isInvalidMoveTarget = (
	channel: Discord.TextChannel,
	targetChannel: Discord.TextChannel
) => {
	return (
		(targetChannel.parent?.id === channel.parent?.id &&
			targetChannel.position + 1 === channel.position) ||
		targetChannel.id === channel.id
	);
};

/**
 * Get the message object from a given message link. Can throw DiscordAPI Error, and returns error messages as string.
 * @param guild - Guild to find message in
 * @param link - Message Link provided by user
 * @returns Discord.Message if found, otherwise Error message
 * @throws DiscordAPIError - if channel or messages are not fetchable
 */
export const getMessageFromLink = async (
	guild: Discord.Guild,
	link: string
): Promise<Discord.Message | string> => {
	const matches = link.match(
		/https:\/\/(?:canary\.)?discord(?:app)?\.com\/channels\/([^/]+)\/([^/]+)\/([^/\s][0-9]+)/
	);
	const ID_MAP = matches
		? { ID_1: matches[1], ID_2: matches[2], ID_3: matches[3] }
		: null;
	if (!(ID_MAP && ID_MAP.ID_1 && ID_MAP.ID_2 && ID_MAP.ID_3)) {
		return "Invalid Message Link";
	}
	if (guild.id !== ID_MAP?.ID_1) {
		return "Please use a message from this server";
	}
	const channel = await guild.channels.fetch(ID_MAP?.ID_2);
	if (!channel || channel.type !== Discord.ChannelType.GuildText) {
		return "Cannot access this channel";
	}
	const message = await channel.messages.fetch(ID_MAP.ID_3);
	if (!message) {
		return "Cannot find this message";
	}
	return message;
};

/**
 * Get the channel object from a given message link. Can throw DiscordAPI Error, and returns error messages as string.
 * @param guild - Guild to find message in
 * @param link - Message Link provided by user
 * @returns Discord.NonThreadGuildBasedChannel if found, otherwise Error message
 * @throws DiscordAPIError - if channel or messages are not fetchable
 */
export const getChannelFromLink = async (
	guild: Discord.Guild,
	link: string
): Promise<Discord.NonThreadGuildBasedChannel | string> => {
	const matches = link.match(
		/https:\/\/(?:canary\.)?discord(?:app)?\.com\/channels\/([^/]+)\/([^/]+)\/([^/\s][0-9]+)/
	);
	const ID_MAP = matches
		? { ID_1: matches[1], ID_2: matches[2], ID_3: matches[3] }
		: null;
	if (!(ID_MAP && ID_MAP.ID_1 && ID_MAP.ID_2 && ID_MAP.ID_3)) {
		return "Invalid Message Link";
	}
	if (guild.id !== ID_MAP?.ID_1) {
		return "Please use a message from this server";
	}
	const channel = await guild.channels.fetch(ID_MAP?.ID_2);
	if (!channel || channel.type !== Discord.ChannelType.GuildText) {
		return "Cannot access this channel";
	}
	return channel;
};

/**
 * Stringifies the embeds with pretty printing and replaces backticks with escaped ones
 * @param embeds - Array of Discord.Embed to show
 * @returns Pretty printed string with backticks escaped
 */
export const sanitizedMessageEmbedString: (
	embeds: Array<Discord.Embed>
) => string = embeds =>
	JSON.stringify(embeds, undefined, 4).replace(/`/g, "\\`");

/**
 * Send a split message in slices if larger than `messageSize`, simply joined otherwise
 * @param interaction Interaction object
 * @param list Array of message chunks to combine
 * @param messageSize Max size of message
 * @param separator Separator to join chunks with, defaults to newline
 */
export async function slicedReply(
	interaction: Discord.CommandInteraction,
	list: string[],
	messageSize: number,
	separator = "\n"
): Promise<void> {
	const joined = list.join(separator);
	if (joined.length > messageSize) {
		let reply: Discord.Message | null = null;
		let slice = "";
		for (let index = 0; index < list.length; index++) {
			if (slice.length + list[index].length > messageSize) {
				reply = await performReply(slice, reply);
				slice = "Continued:\n"; // new line regardless of separator
			} else {
				slice += `${list[index]}${separator}`;
				if (index === list.length - 1) {
					reply = await performReply(slice, reply);
				}
			}
		}
	} else {
		interaction.reply(joined);
	}

	async function performReply(
		slice: string,
		reply: Discord.Message | null
	): Promise<Discord.Message | null> {
		const response = { content: slice, fetchReply: true } as const;
		if (interaction.replied) {
			if (reply) {
				reply = await reply.reply(response);
			}
		} else {
			reply = await interaction.reply(response);
		}
		return reply;
	}
}
