import { ChannelTypes } from "discord.js/typings/enums";
import { CombinedApplicationCommand } from "../../bot";
import Discord from "discord.js";
import { hiddenReply } from "../../utils/helpers";

const FLAGS = Discord.Permissions.FLAGS;
const BOT_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.EMBED_LINKS | FLAGS.ADD_REACTIONS;
const USER_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.MANAGE_MESSAGES | FLAGS.MANAGE_ROLES;

export const MF_Comamnds: CombinedApplicationCommand[] = [
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
						for (let index = 0; index < 6; ++index) {
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
	}
];