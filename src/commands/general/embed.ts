import Discord from "discord.js";
import axios from "axios";
import { ChannelTypes } from "discord.js/typings/enums";
import { CombinedSlashCommand } from "../../bot";
import { FLAGS, hiddenReply } from "../../utils/helpers";
import { CmdKind } from "../mafia/mafia";

const USER_PERMS = FLAGS.ADMINISTRATOR;
const BOT_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.EMBED_LINKS | FLAGS.ATTACH_FILES;

export const embedCommands: CombinedSlashCommand[] = [
	{
		kind: CmdKind.SLASH,
		name: "sendembed",
		description: "Send an embed in a channel",
		options: [
			{
				name: "target",
				description: "Target channel to send embed to",
				type: "CHANNEL",
				channelTypes: [ChannelTypes.GUILD_TEXT],
				required: true
			},
			{
				name: "json",
				description: "JSON data as text to embed",
				type: "STRING",
				required: false
			},
			{
				name: "file",
				description: "JSON data as file to embed",
				type: "STRING",
				required: false
			}
		],
		action: async (interaction: Discord.CommandInteraction) => {
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
			const channel = interaction.options.getChannel("target") as Discord.TextChannel;
			// check permissions
			if (!channel.permissionsFor(member).has(USER_PERMS)) {
				hiddenReply(interaction, "You do not have valid perms to use this");
				return;
			} else if (!channel.permissionsFor(guild.me).has(BOT_PERMS)) {
				hiddenReply(interaction, "Bot cannot send embeds in this channel");
				return;
			}
			const fileJSON = interaction.options.getString("file", false);
			const textJSON = interaction.options.getString("json", false);
			if (!(fileJSON || textJSON)) {
				hiddenReply(interaction, "Please provide either the file url or the json as text");
				console.error("No data provided");
				return;
			}
			// text is priority over file
			if (textJSON) {
				if (await handleText(interaction, channel, textJSON)) {
					interaction.reply(`Embed sent to ${channel.toString()}`);
				}
			} else {
				if (await handleFile(interaction, channel, fileJSON)) {
					interaction.reply(`Embed sent to ${channel.toString()}`);
				}
			}

		}
	}
];

async function sendEmbed(channel: Discord.TextChannel, data: unknown): Promise<void> {
	const json = [].concat(data);
	const embeds = json.map((entry: unknown) => new Discord.MessageEmbed(entry));
	await channel.send({ embeds });
}

async function handleText(interaction: Discord.CommandInteraction, channel: Discord.TextChannel, textJSON: string): Promise<boolean> {
	try {
		sendEmbed(channel, JSON.parse(textJSON));
	} catch (err) {
		hiddenReply(interaction, "Invalid json, could not produce embed");
		console.error(err);
		return false;
	}
	return true;
}

async function handleFile(interaction: Discord.CommandInteraction, channel: Discord.TextChannel, fileJSON: string): Promise<boolean> {
	try {
		const url = new URL(fileJSON);
		if(url.protocol !== "https:") {
			throw Error("Invalid protocol");
		}
		const response = await axios({
			method: "get",
			url: url.href,
			responseType: "json"
		});
		try {
			sendEmbed(channel, response.data);
		} catch (err) {
			hiddenReply(interaction, "Invalid json, could not produce embed");
			console.error(err);
			return false;
		}
		
	} catch (err) {
		hiddenReply(interaction, "Invalid url, could not produce embed");
		console.error(err);
		return false;
	}
	return true;
}