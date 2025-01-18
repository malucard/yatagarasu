import * as Discord from "discord.js";
import {
	CmdKind,
	CombinedSlashCommand,
	hiddenReply,
	slicedReply,
} from "../../utils/helpers";

const USER_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.ManageChannels;

const BOT_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.ManageChannels;

const BOT_SEND_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages;

export const categoryCommands: CombinedSlashCommand[] = [
	{
		name: "category",
		description: "Category Commands",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "list",
				description: "Show a list of channels in the given category",
				type: Discord.ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: "category",
						description: "Category to check",
						type: Discord.ApplicationCommandOptionType.Channel,
						channelTypes: [Discord.ChannelType.GuildCategory],
						required: true,
					},
				],
			},
		],
		action: async (interaction: Discord.ChatInputCommandInteraction) => {
			const user = interaction.user;
			const guild = interaction.guild;
			if (!guild) {
				hiddenReply(interaction, "An error occured");
				return;
			}
			const member = await guild.members.fetch(user);
			if (!member) {
				hiddenReply(interaction, "An error occured");
				console.error("Member not found");
				return;
			}
			const subcommand = interaction.options.getSubcommand(true);
			switch (subcommand) {
				case "list":
					await handleList(interaction, guild, member);
					return;
			}
		},
	},
];

async function handleList(
	interaction: Discord.ChatInputCommandInteraction,
	guild: Discord.Guild,
	member: Discord.GuildMember
): Promise<void> {
	const channel = interaction.channel;
	const category = interaction.options.getChannel("category", true, [
		Discord.ChannelType.GuildCategory,
	]);
	const me = await guild.members.fetchMe();
	if (!me) {
		hiddenReply(interaction, "An error occured");
		return;
	}
	if (!channel) {
		hiddenReply(interaction, "An error occured");
		return;
	}
	if (!(channel instanceof Discord.TextChannel)) {
		hiddenReply(interaction, "This command must be used in a text channel");
		return;
	}
	// check permissions
	if (!category.permissionsFor(member).has(USER_PERMS)) {
		hiddenReply(interaction, "You do not have valid perms to use this");
		return;
	} else if (!channel?.permissionsFor(me).has(BOT_SEND_PERMS)) {
		hiddenReply(interaction, "Bot cannot send embeds in this channel");
		return;
	} else if (!category.permissionsFor(me).has(BOT_PERMS)) {
		hiddenReply(
			interaction,
			"Bot does not have valid perms for the category"
		);
		return;
	}
	const { children } = category;
	let index = 0;
	const list: Array<string> = children.cache
		.sort((a, b) => a.rawPosition - b.rawPosition)
		.map(child => {
			index++;
			return `${index}: ${child.toString()} - (${child.name})`;
		});
	list.unshift(`Total Channels: ${children.cache.size}`);
	const messageSize = 1500;
	await slicedReply(interaction, list, messageSize, "\n");
}
