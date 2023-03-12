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
				description: "Target channel to send embeds to",
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
			},
			{
				name: "text",
				description: "Text to show along with the embeds",
				type: "STRING",
				required: false
			},
			{
				name: "message",
				description: "Discord message to clone text from instead of 'text'",
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
			const text = interaction.options.getString("text", false);
			const message = interaction.options.getString("message", false);
			if (!(fileJSON || textJSON)) {
				hiddenReply(interaction, "Please provide either the file url or the json as text");
				console.error("No data provided");
				return;
			}
			try {
				const messageText = await getMessageText(guild, text, message);
				// text is priority over file
				if (textJSON) {
					if (await handleText(interaction, channel, textJSON, messageText)) {
						interaction.reply(`Embed sent to ${channel.toString()}`);
					}
				} else {
					if (await handleFile(interaction, channel, fileJSON, messageText)) {
						interaction.reply(`Embed sent to ${channel.toString()}`);
					}
				}
			}
			catch (error) {
				hiddenReply(interaction, error.message);
				return;
			}
		}
	}
];

async function sendEmbed(channel: Discord.TextChannel, data: unknown, content?: string): Promise<void> {
	const json = [].concat(data);
	const embeds = json.map((entry: unknown) => new Discord.MessageEmbed(entry));
	await channel.send({ content, embeds });
}

async function handleText(interaction: Discord.CommandInteraction, channel: Discord.TextChannel, textJSON: string, messageText?: string): Promise<boolean> {
	try {
		sendEmbed(channel, JSON.parse(textJSON), messageText);
	} catch (err) {
		hiddenReply(interaction, "Invalid json, could not produce embed");
		console.error(err);
		return false;
	}
	return true;
}

async function handleFile(interaction: Discord.CommandInteraction, channel: Discord.TextChannel, fileJSON: string, messageText?: string): Promise<boolean> {
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
			sendEmbed(channel, response.data, messageText);
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

async function getMessageText(guild: Discord.Guild, text?: string, messageLink?: string): Promise<string | undefined> {
	if (!text && !messageLink) {
		return undefined;
	}
	if (text) {
		return text;
	}
	const ID_MAP = /https:\/\/(?:canary\.)?discord(?:app)?\.com\/channels\/(?<ID_1>[^/]+)\/(?<ID_2>[^/]+)\/(?<ID_3>[^/\s][0-9]+)/.exec(messageLink).groups;
	if (!(ID_MAP && ID_MAP.ID_1 && ID_MAP.ID_2 && ID_MAP.ID_3)) {
		throw Error("Invalid Message Link");
	}
	if (guild.id !== ID_MAP?.ID_1) {
		throw Error("Please use a message from this server");
	}
	const channel = await guild.channels.fetch(ID_MAP?.ID_2);
	if (!(channel && channel.isText())) {
		throw Error("Cannot access this channel");
	}
	const message = await channel.messages.fetch(ID_MAP.ID_3);
	if (!message) {
		throw Error("Cannot find this message");
	}
	return message.content;
}