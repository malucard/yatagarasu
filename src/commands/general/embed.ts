import Discord from "discord.js";
import axios from "axios";
import { CmdKind, CombinedSlashCommand, getChannelFromLink, getMessageFromLink, hiddenReply, sanitizedMessageEmbedString } from "../../utils/helpers";

const USER_SEND_PERMS = Discord.PermissionFlagsBits.Administrator;
const BOT_SEND_PERMS = Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.SendMessages | Discord.PermissionFlagsBits.EmbedLinks;
const BOT_FETCH_PERMS = Discord.PermissionFlagsBits.ViewChannel | Discord.PermissionFlagsBits.SendMessages | Discord.PermissionFlagsBits.EmbedLinks;

export const embedCommands: CombinedSlashCommand[] = [
	{
		kind: CmdKind.SLASH,
		name: "embed",
		description: "Embed Commands",
		options: [
			{
				name: "send",
				description: "Send embeds",
				type: Discord.ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: "target",
						description: "Target channel to send embeds to",
						type: Discord.ApplicationCommandOptionType.Channel,
						channelTypes: [Discord.ChannelType.GuildText],
						required: true
					},
					{
						name: "json_text",
						description: "JSON data as text to embed",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "json_file",
						description: "JSON data as file to embed",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "text",
						description: "Text to show along with the embeds",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "message",
						description: "Discord message to clone text from instead of 'text'",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					}
				]
			}, {
				name: "fetch",
				description: "Get embeds from a message",
				type: Discord.ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: "message",
						description: "Message Link to get embed json from",
						type: Discord.ApplicationCommandOptionType.String,
						required: true
					}
				]
			},
			{
				name: "edit",
				description: "Edit Embeds",
				type: Discord.ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: "target",
						description: "Target message link to edit embed from",
						type: Discord.ApplicationCommandOptionType.String,
						required: true
					},
					{
						name: "json_text",
						description: "JSON data as text to embed",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "json_file",
						description: "JSON data as file to embed",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "text",
						description: "Text to show along with the embeds",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					},
					{
						name: "message",
						description: "Discord message to clone text from instead of 'text'",
						type: Discord.ApplicationCommandOptionType.String,
						required: false
					}
				]
			}
		],
		action: async (interaction: Discord.ChatInputCommandInteraction) => {
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
			case "edit":
				handleEdit(interaction, guild, member);
			}
		}
	}
];

// Sub-Command Send
async function handleSend(interaction:Discord.ChatInputCommandInteraction, guild: Discord.Guild, member: Discord.GuildMember) {
	const channel = interaction.options.getChannel("target") as Discord.TextChannel;
	const me = await guild.members.fetchMe();
	// check permissions
	if (!channel.permissionsFor(member).has(USER_SEND_PERMS)) {
		hiddenReply(interaction, "You do not have valid perms to use this");
		return;
	} else if (!channel.permissionsFor(me).has(BOT_SEND_PERMS)) {
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
		const content = await getMessageText(guild, text, message);
		const json = await getJSON(fileJSON, textJSON);
		if (!json) {
			throw Error("Please recheck the json given");
		}
		const embeds = [].concat(json).map((entry: unknown) => new Discord.EmbedBuilder(entry));
		await channel.send({ content, embeds });
		interaction.reply(`Embed sent to ${channel.toString()}`);
	}
	catch (error) {
		hiddenReply(interaction, error.message);
		return;
	}
}
// End of Sub-Command Send

// Sub-Command Fetch
async function handleFetch(interaction: Discord.ChatInputCommandInteraction, guild: Discord.Guild, member: Discord.GuildMember) {
	const channel = interaction.channel;
	const me = await guild.members.fetchMe();
	// check permissions
	if (!channel.permissionsFor(member).has(USER_SEND_PERMS)) {
		hiddenReply(interaction, "You do not have valid perms to use this");
		return;
	} else if (!channel.permissionsFor(me).has(BOT_FETCH_PERMS)) {
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
// End of Sub-Command Fetch

// Sub-Command Edit
async function handleEdit(interaction: Discord.ChatInputCommandInteraction, guild: Discord.Guild, member: Discord.GuildMember) {
	const targetURL = interaction.options.getString("target");
	try {
		const channel = await getChannelFromLink(guild, targetURL);
		if (typeof channel === "string") {
			throw Error(channel);
		}
		const me = await guild.members.fetchMe();
		// check permissions
		if (!channel.permissionsFor(member).has(USER_SEND_PERMS)) {
			hiddenReply(interaction, "You do not have valid perms to use this");
			return;
		} else if (!channel.permissionsFor(me).has(BOT_SEND_PERMS)) {
			hiddenReply(interaction, "Bot cannot send messages in this channel");
			return;
		}
		const target = await getMessageFromLink(guild, targetURL);
		if (typeof target === "string") {
			throw Error(target);
		} else if (target.member.id !== me.id) {
			hiddenReply(interaction, "Cannot edit messages outside mine");
			return;
		}
		const fileJSON = interaction.options.getString("json_file", false);
		const textJSON = interaction.options.getString("json_text", false);
		const text = interaction.options.getString("text", false);
		const message = interaction.options.getString("message", false);
		if (!(fileJSON || textJSON || text || message)) {
			hiddenReply(interaction, "Please provide either embed or text to edit");
			return;
		}
		const json = await getJSON(fileJSON, textJSON);
		const content = await getMessageText(guild, text, message) || undefined;
		if (!(json || content)) {
			hiddenReply(interaction, "Please check the data given");
			return;
		}
		const embeds = json ? [].concat(json).map((entry: unknown) => new Discord.EmbedBuilder(entry)) : undefined;
		await target.edit({	content, embeds });
		interaction.reply("Embed Edited");

	} catch(error) {
		hiddenReply(interaction, error.message);
		return;
	}
}
// End of Sub-Command Edit

// Shared
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
async function getJSON(fileJSON: string, textJSON: string): Promise<unknown> {
	if (textJSON) {
		return JSON.parse(textJSON);
	} else if (fileJSON) {
		const url = new URL(fileJSON);
		if(url.protocol !== "https:") {
			throw Error("Invalid protocol");
		}
		const response = await axios({
			method: "get",
			url: url.href,
			responseType: "json"
		});
		return response.data;
	}
	return undefined;
}
