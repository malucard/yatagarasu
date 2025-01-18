import * as Discord from "discord.js";
import {
	CmdKind,
	CombinedSlashCommand,
	hiddenReply,
} from "../../utils/helpers";

const BOT_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.EmbedLinks |
	Discord.PermissionFlagsBits.AddReactions;
const USER_PERMS =
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ManageMessages |
	Discord.PermissionFlagsBits.ManageRoles;

export const MF_Commands: CombinedSlashCommand[] = [
	{
		name: "mysterypoll",
		description:
			"Creates a mystery voting poll. For use in Mystery-Fiction.",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "name",
				description: "Name of the game to poll",
				type: Discord.ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: "link",
				description:
					"Message Link to the submission from the user. Do not escape it with brackets.",
				type: Discord.ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: "channel",
				description:
					"Channel to send it to (defaults to current channel)",
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText],
				required: false,
			},
		],
		action: async interaction => {
			const member = interaction.member as Discord.GuildMember;
			const usedChannel = interaction.channel;
			const me = await interaction.guild?.members.fetchMe();

			const name = interaction.options.getString("name", true);
			const link = interaction.options.getString("link", true);
			if (!link.startsWith("http")) {
				hiddenReply(interaction, "Link is invalid");
				return;
			}
			const targetChannel = interaction.options.getChannel(
				"channel",
				false
			);
			let channel: Discord.TextChannel | undefined;
			if (targetChannel instanceof Discord.TextChannel) {
				channel = targetChannel;
			} else if (targetChannel) {
				hiddenReply(
					interaction,
					`${targetChannel.toString()} is not a text channel.`
				);
				return;
			} else if (usedChannel instanceof Discord.TextChannel) {
				channel = usedChannel;
			} else if (usedChannel) {
				hiddenReply(
					interaction,
					`${usedChannel.toString()} is not a text channel.`
				);
				return;
			}
			if (!channel) {
				hiddenReply(
					interaction,
					"Channel does not exist or is invalid"
				);
				return;
			}
			if (!me) {
				hiddenReply(interaction, "Bot not found in guild");
				return;
			}
			if (!channel.permissionsFor(me).has(BOT_PERMS)) {
				const missing = channel
					.permissionsFor(me)
					.missing(BOT_PERMS)
					.join(", ");
				hiddenReply(
					interaction,
					`Bot does not have valid perms ${missing}`
				);
				return;
			}
			if (!channel.permissionsFor(member).has(USER_PERMS)) {
				hiddenReply(
					interaction,
					"You do not have permissions to use this command"
				);
				return;
			}
			const message = await channel.send({
				embeds: [
					{
						title: name,
						description: [
							"1\u20e3 - Have Played",
							"2\u20e3 - Have Planned / Are Playing",
							"3\u20e3 - Interested in the Future",
							"4\u20e3 - Is Mystery and Belongs here",
							"5\u20e3 - Does not Belong here (mention why)",
							"6\u20e3 - Is NOT a mystery title (mention why)",
						].join("\n"),
						url: link,
					},
				],
				components: [
					{
						type: Discord.ComponentType.ActionRow,
						components: [
							{
								type: Discord.ComponentType.Button,
								url: link,
								style: Discord.ButtonStyle.Link,
								label: "Go to Suggestion Post",
								disabled: false,
							},
						],
					},
				],
			});
			hiddenReply(interaction, "Poll sent.");
			for (let index = 1; index <= 6; ++index) {
				await message.react(`${index}\u20e3`);
			}
		},
	},
	{
		name: "mysterylist",
		description: "Commands for the mysterylist",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "action",
				description: "Add or Remove from the Mystery List",
				type: Discord.ApplicationCommandOptionType.String,
				choices: [
					{
						name: "Add Game",
						value: "add",
					},
					{
						name: "Remove Game",
						value: "remove",
					},
				],
				required: true,
			},
			{
				name: "name",
				description: "Name of the Game",
				type: Discord.ApplicationCommandOptionType.String,
				required: true,
			},
		],
		action: async interaction => {
			const guild = interaction.guild;
			const me = await guild?.members.fetchMe();
			const mysteryListChannel = guild?.channels.cache.find(
				channel => channel.name === "mystery-list"
			);
			const member = interaction.member as Discord.GuildMember;
			const action = interaction.options.getString("action");
			if (
				!member.permissions.has(
					Discord.PermissionFlagsBits.Administrator
				)
			) {
				hiddenReply(interaction, "Only admins can use these commands");
				return;
			}
			if (!me) {
				hiddenReply(interaction, "Bot not found in guild");
				return;
			}
			if (
				!mysteryListChannel ||
				!(mysteryListChannel instanceof Discord.TextChannel)
			) {
				hiddenReply(interaction, "Mystery List channel not found.");
				return;
			}
			if (!me.permissionsIn(mysteryListChannel).has(BOT_PERMS)) {
				hiddenReply(
					interaction,
					"Bot does not have valid perms for mystery list channel"
				);
				return;
			}
			let name = interaction.options.getString("name");
			const messages = (await mysteryListChannel.messages.fetch()).filter(
				message => message.author.id === me.id
			);
			const message = messages
				.filter(message =>
					message.embeds.some(embed =>
						embed.title?.startsWith("Other Games")
					)
				)
				.first();
			if (!message) {
				hiddenReply(interaction, "Mystery List message not found.");
				return;
			}
			const embeds = message.embeds.filter(embed =>
				embed.title?.startsWith("Other Games")
			);
			const games = embeds.flatMap(
				embed => embed.description?.split("\n") ?? []
			);
			if (action === "add" && name) {
				games.push(name);
			} else {
				const index = games.findIndex(
					game => game.toLowerCase() === name?.toLowerCase()
				);
				if (index > -1) {
					[name] = games.splice(index, 1);
				} else {
					hiddenReply(interaction, "Game not found.");
					return;
				}
			}
			games.sort();
			const [header, spoiler, ...others] = message.embeds.map(embed =>
				embed.toJSON()
			);
			const tiermakers = others.at(-1);
			const newOthers = getNewOthers(games);
			if (newOthers.length > 7) {
				hiddenReply(interaction, "Too many embeds");
				return;
			}
			// edit the embed
			message.edit({
				embeds: Array<Discord.APIEmbed>().concat(
					header,
					spoiler,
					newOthers,
					tiermakers ?? []
				),
			});
			if (action === "add") {
				hiddenReply(
					interaction,
					`${name} added to ${mysteryListChannel.toString()}`
				);
			} else {
				hiddenReply(
					interaction,
					`${name} removed from ${mysteryListChannel.toString()}`
				);
			}
		},
	},
];

function getNewOthers(games: string[]): Discord.APIEmbed[] {
	let join = "";
	const descriptions: string[] = [];
	for (let index = 0; index < games.length; index++) {
		const game = games[index];
		if (join.length + game.length > 4000) {
			// I'm not touching the 4096 limit with a 100 character pole
			descriptions.push(join);
			join = "";
		}
		join = !join ? game : `${join}\n${game}`;
	}
	descriptions.push(join);
	const newOthers: Discord.APIEmbed[] = descriptions.map(
		(description, index) =>
			new Discord.EmbedBuilder()
				.setTitle(`Other Games${index > 0 ? " (continued)" : ""}`)
				.setDescription(description)
				.toJSON()
	);
	return newOthers;
}
