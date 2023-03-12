import Discord from "discord.js";
import axios from "axios";
import { ChannelTypes } from "discord.js/typings/enums";
import { CombinedSlashCommand } from "../../bot";
import { FLAGS, getMessageFromLink, hiddenReply, sanitizedMessageEmbedString } from "../../utils/helpers";
import { CmdKind } from "../mafia/mafia";

const USER_SEND_PERMS = FLAGS.ADMINISTRATOR;
const BOT_SEND_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.EMBED_LINKS;
const BOT_FETCH_PERMS = FLAGS.VIEW_CHANNEL | FLAGS.SEND_MESSAGES | FLAGS.EMBED_LINKS;

export const embedCommands: CombinedSlashCommand[] = [
	{
		kind: CmdKind.SLASH,
		name: "embed",
		description: "Embed Commands",
		options: [
			{
				name: "send",
				description: "Send embeds",
				type: "SUB_COMMAND",
				options: [
					{
						name: "target",
						description: "Target channel to send embeds to",
						type: "CHANNEL",
						channelTypes: [ChannelTypes.GUILD_TEXT],
						required: true
					},
					{
						name: "json_text",
						description: "JSON data as text to embed",
						type: "STRING",
						required: false
					},
					{
						name: "json_file",
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
				]
			}, {
				name: "fetch",
				description: "Get embeds from a message",
				type: "SUB_COMMAND",
				options: [
					{
						name: "message",
						description: "Message Link to get embed json from",
						type: "STRING",
						required: true
					}
				]
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
			const subcommand = interaction.options.getSubcommand(true);
			switch (subcommand) {
			case "send": 
				handleSend(interaction, guild, member);
				return;
			case "fetch":
				handleFetch(interaction, guild, member);
				return;
			}
		}
	}
];

async function handleSend(interaction:Discord.CommandInteraction, guild: Discord.Guild, member: Discord.GuildMember) {
	const channel = interaction.options.getChannel("target") as Discord.TextChannel;
	// check permissions
	if (!channel.permissionsFor(member).has(USER_SEND_PERMS)) {
		hiddenReply(interaction, "You do not have valid perms to use this");
		return;
	} else if (!channel.permissionsFor(guild.me).has(BOT_SEND_PERMS)) {
		hiddenReply(interaction, "Bot cannot send embeds in this channel");
		return;
	}
	const fileJSON = interaction.options.getString("json_file", false);
	const textJSON = interaction.options.getString("json_text", false);
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
	const message = await getMessageFromLink(guild, messageLink);
	if (typeof message === "string") {
		throw Error(message);
	}
	return message.content;
}

async function handleFetch(interaction: Discord.CommandInteraction, guild: Discord.Guild, member: Discord.GuildMember) {
	const channel = interaction.channel;
	// check permissions
	if (!channel.permissionsFor(member).has(USER_SEND_PERMS)) {
		hiddenReply(interaction, "You do not have valid perms to use this");
		return;
	} else if (!channel.permissionsFor(guild.me).has(BOT_FETCH_PERMS)) {
		hiddenReply(interaction, "Bot cannot send messages in this channel");
		return;
	}
	const link = interaction.options.getString("message");
	try {
		await interaction.deferReply();
		const message = await getMessageFromLink(guild, link);
		if (typeof message === "string") {
			throw Error(message);
		}
		const sanitized = sanitizedMessageEmbedString(message.embeds);
		const CHUNK_SIZE = 4096 - 8; // backticks and newline
		if (sanitized.length < CHUNK_SIZE) {
			interaction.followUp({
				embeds: [{
					title: "Embed Source",
					description: codeTicks(sanitized)
				}]
			});
		} else {
			const chunkCount = Math.ceil(sanitized.length / CHUNK_SIZE);
			if (chunkCount > 10) {
				throw Error("Embed too large to get source from");
			}
			for (let index = 0; index < chunkCount; ++index) {
				const substr = sanitized.substring(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
				interaction.followUp({
					embeds: [{
						title: index ? "Continued..." : "Embed Source",
						description: codeTicks(substr)
					}]
				});
			}
		}
		
	} catch (error) {
		hiddenReply(interaction, error.message);
		return;
	}
}

const codeTicks = (input: string) => "```\n" + input + "\n```";
