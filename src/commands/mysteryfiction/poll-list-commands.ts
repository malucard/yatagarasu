import { ChannelTypes } from "discord.js/typings/enums";
import { CombinedApplicationCommand } from "../../bot";
import Discord from "discord.js";
import { hiddenReply } from "../../utils/helpers";

const FLAGS = Discord.Permissions.FLAGS;
const BOT_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.EMBED_LINKS | FLAGS.ADD_REACTIONS;
const USER_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.MANAGE_MESSAGES | FLAGS.MANAGE_ROLES;

export const MF_Commands: CombinedApplicationCommand[] = [
	{
		name: "mysterypoll",
		description: "Creates a mystery voting poll. For use in Mystery-Fiction.",
		options: [
			{
				name: "name",
				description: "Name of the game to poll",
				type: "STRING",
				required: true
			},
			{
				name: "link",
				description: "Message Link to the submission from the user. Do not escape it with brackets.",
				type: "STRING",
				required: true
			},
			{
				name: "channel",
				description: "Channel to send it to (defaults to current channel)",
				type: "CHANNEL",
				channelTypes: [ChannelTypes.GUILD_TEXT],
				required: false
			}
		],
		action: async (interaction: Discord.CommandInteraction) => {
			const member = interaction.member as Discord.GuildMember;
			const usedChannel = interaction.channel;
			const me = interaction.guild.me;

			const name = interaction.options.getString("name", true);
			const link = interaction.options.getString("link", true);
			if (!link.startsWith("http")) {
				hiddenReply(interaction, "Link is invalid");
				return;
			}
			const targetChannel = interaction.options.getChannel("channel", false);
			let channel: Discord.TextChannel;
			if (targetChannel instanceof Discord.TextChannel) {
				channel = targetChannel;
			} else if (targetChannel) {
				hiddenReply(interaction, `${targetChannel.toString()} is not a text channel.`);
				return;
			} else if (usedChannel instanceof Discord.TextChannel) {
				channel = usedChannel;
			} else if (usedChannel) {
				hiddenReply(interaction, `${usedChannel.toString()} is not a text channel.`);
				return;
			}
			if (channel) {
				if (channel.permissionsFor(me).has(BOT_PERMS)) {
					if (channel.permissionsFor(member).has(USER_PERMS)) {
						const message = await channel.send({
							embeds: [{
								title: name,
								description: [
									"1\u20e3 - Have Played",
									"2\u20e3 - Have Planned / Are Playing",
									"3\u20e3 - Interested in the Future",
									"4\u20e3 - Is Mystery and Belongs here",
									"5\u20e3 - Does not Belong here (mention why)",
									"6\u20e3 - Is NOT a mystery title (mention why)"
								].join("\n"),
								url: link
							}],
							components: [{
								type: "ACTION_ROW",
								components: [{
									type: "BUTTON",
									url: link,
									style: "LINK",
									label: "Go to Suggestion Post",
									disabled: false
								}]
							}]
						});
						hiddenReply(interaction, "Poll sent.");
						for (let index = 1; index <= 6; ++index) {
							await message.react(`${index}\u20e3`);
						}
					} else {
						hiddenReply(interaction, "You do not have permissions to use this command");
					}
				} else {
					const missing = channel.permissionsFor(me).missing(BOT_PERMS).join(", ");
					hiddenReply(interaction, `Bot does not have valid perms ${missing}`);
				}
			} else {
				hiddenReply(interaction, "Channel does not exist or is invalid");
			}
		}
	},
	{
		name: "mysterylist",
		description: "Commands for the mysterylist",
		options: [
			{
				name: "add",
				type: "SUB_COMMAND",
				description: "Add an entry to the mystery list",
				options: [
					{
						name: "name",
						description: "Name of the game to add to the list",
						type: "STRING",
						required: true
					}
				]
			}, {
				name: "remove",
				type: "SUB_COMMAND",
				description: "Remove an entry from the mystery list",
				options: [
					{
						name: "name",
						description: "Name of the game to remove from the list",
						type: "STRING",
						required: true,
						autocomplete: true
					}
				]
			}
		],
		action: async interaction => {
			const guild = interaction.guild;
			const me = guild.me;
			const mysteryListChannel = guild.channels.cache.find(channel => channel.name === "mystery-list");
			const member = interaction.member as Discord.GuildMember;
			if (!member.permissions.has("ADMINISTRATOR")) {
				hiddenReply(interaction, "Only admins can use these commands");
				return;
			}
			if (!me.permissionsIn(mysteryListChannel).has(BOT_PERMS)) {
				hiddenReply(interaction, "Bot does not have valid perms for mystery list channel");
				return;
			}
			if (interaction.options.getSubcommand() === "add") {
				const newGame = interaction.options.getString("name");
				if (mysteryListChannel instanceof Discord.TextChannel) {
					const messages = await mysteryListChannel.awaitMessages({
						filter: message => message.author.id === me.id && message.embeds.length > 0
					});
					const message = messages.filter(message => message.embeds.some(embed => embed.title.startsWith("Other Games"))).first();
					const embeds = message.embeds.filter(embed => embed.title.startsWith("Other Games"));

					const games = embeds.flatMap(embed => embed.description.split("\n"));
					games.push(newGame);
					games.sort();
					let join = "";
					const descriptions: string[] = [];
					for (let index = 0; index < games.length; index++) {
						const game = games[index];
						if (join.length + game.length > 4000) {
							// I'm not touching the 4096 limit with a 100 character pole
							descriptions.push(join);
							join = "";
						}
						join = join ? game : `${join}\n${game}`;
					}
					descriptions.push(join);
					const [header, spoiler, ...others] = message.embeds;
					const tiermakers = others.at(-1);
					const newOthers: Discord.MessageEmbed[] = descriptions.map((description, index) => new Discord.MessageEmbed({
						title: `Other Games${index ? " (continued)" : ""}`,
						description: description
					}));
					if (newOthers.length > 7) {
						hiddenReply(interaction, "Too many embeds");
						return;
					}
					const actuallyDoIt = false;
					if (actuallyDoIt) {
						// edit the embed
						message.edit({
							embeds: [header, spoiler, ...newOthers, tiermakers]
						});
						hiddenReply(interaction, `${newGame} added to ${mysteryListChannel.toString()}`);
					} else {
						// send the updated embed as a reply
						if (me.permissionsIn(interaction.channel).has(BOT_PERMS)) {
							interaction.reply({
								content: "This is how it would look like",
								embeds: [header, spoiler, ...newOthers, tiermakers]
							});
						} else {
							hiddenReply(interaction, "Could not reply to you in this channel");
							return;
						}
					}
				}
			} else if (interaction.options.getSubcommand() === "remove") {
				// remove
				hiddenReply(interaction, "Not implemented yet.");
				return;
			}
		}
	}
];