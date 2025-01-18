import * as Discord from "discord.js";
import { CmdKind, CombinedSlashCommand } from "../../utils/helpers";

const BOT_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.EmbedLinks |
	Discord.PermissionFlagsBits.AddReactions |
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ManageMessages |
	Discord.PermissionFlagsBits.ManageRoles |
	Discord.PermissionFlagsBits.UseApplicationCommands |
	Discord.PermissionFlagsBits.SendMessagesInThreads |
	Discord.PermissionFlagsBits.CreatePrivateThreads |
	Discord.PermissionFlagsBits.CreatePublicThreads;
const USER_PERMS =
	Discord.PermissionFlagsBits.Administrator |
	Discord.PermissionFlagsBits.ModerateMembers |
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.EmbedLinks |
	Discord.PermissionFlagsBits.AddReactions |
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ManageMessages |
	Discord.PermissionFlagsBits.ManageRoles;
const BOT_PERMS_CAPTCHA =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages |
	Discord.PermissionFlagsBits.AddReactions |
	Discord.PermissionFlagsBits.ManageChannels |
	Discord.PermissionFlagsBits.ManageMessages |
	Discord.PermissionFlagsBits.ManageRoles;

export const securityCommands: CombinedSlashCommand[] = [
	{
		name: "instantdeathrole",
		description: "Makes a role unable to see all channels",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "role",
				description: "Role that should be banned from all channels",
				type: Discord.ApplicationCommandOptionType.Role,
				required: true,
			},
			{
				name: "channel",
				description:
					"Channel to exclude (the one with the instant death button)",
				type: Discord.ApplicationCommandOptionType.Channel,
				channelTypes: [Discord.ChannelType.GuildText],
				required: true,
			},
		],
		action: async interaction => {
			await interaction.deferReply({
				ephemeral: true,
			});
			const guild = interaction.guild;
			if (!guild) {
				interaction.editReply("An error occured");
				return;
			}
			const me = await guild.members.fetchMe();
			const optionRole = interaction.options.getRole("role");
			if (!optionRole) {
				interaction.editReply("An error occured");
				return;
			}
			const role = await guild.roles.fetch(optionRole.id);
			if (!role) {
				interaction.editReply("An error occured");
				return;
			}
			const channelToExclude = interaction.options.getChannel("channel");
			const member = interaction.member as Discord.GuildMember;
			if (!member.permissions.has(USER_PERMS)) {
				interaction.editReply({
					content: "Only admins can use these commands",
				});
				return;
			}
			if (!me.permissions.has(BOT_PERMS)) {
				interaction.editReply({
					content: "I do not have valid permissions for this action",
				});
				return;
			}
			if (me.roles.highest.comparePositionTo(role) <= 0) {
				interaction.editReply({
					content:
						"The role is higher than my own roles, so I cannot do that",
				});
				return;
			}
			let successes = 0;
			let failures = 0;
			const promises = [];
			for (const channel_ of await guild.channels.fetch()) {
				const channel = channel_[1];
				if (
					channel?.type === Discord.ChannelType.GuildText &&
					me.permissionsIn(channel).has(BOT_PERMS)
				) {
					if (channel.id == channelToExclude?.id) {
						promises.push(
							channel.permissionOverwrites.edit(role, {
								ViewChannel: true,
								SendMessages: false,
								AddReactions: false,
								SendMessagesInThreads: false,
								UseApplicationCommands: false,
								CreatePrivateThreads: false,
								CreatePublicThreads: false,
							})
						);
					} else {
						promises.push(
							channel.permissionOverwrites.edit(role, {
								ViewChannel: false,
								SendMessages: false,
								UseApplicationCommands: false,
								AddReactions: false,
								CreatePrivateThreads: false,
								CreatePublicThreads: false,
							})
						);
					}
					successes += 1;
				} else {
					failures += 1;
				}
			}
			for (const p of promises) {
				await p
					.then(() => (successes += 1))
					.catch(() => (failures += 1));
			}
			await interaction.editReply({
				content: `Succeeded for ${successes} channels, failed for ${failures} channels. Please view the server as the role to see if the result is correct.`,
			});
		},
	},
	{
		name: "mutedrole",
		description: "Makes a role unable to speak in all channels",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "role",
				description: "Role that should be muted in all channels",
				type: Discord.ApplicationCommandOptionType.Role,
				required: true,
			},
		],
		action: async interaction => {
			await interaction.deferReply({
				ephemeral: true,
			});
			const guild = interaction.guild;
			if (!guild) {
				interaction.editReply("An error occured");
				return;
			}
			const me = await guild.members.fetchMe();
			const optionRole = interaction.options.getRole("role");
			if (!optionRole) {
				interaction.editReply("An error occured");
				return;
			}
			const role = await guild.roles.fetch(optionRole.id);
			if (!role) {
				interaction.editReply("An error occured");
				return;
			}
			const member = interaction.member as Discord.GuildMember;
			if (!member.permissions.has(USER_PERMS)) {
				interaction.editReply({
					content: "Only admins can use these commands",
				});
				return;
			}
			if (!me.permissions.has(BOT_PERMS)) {
				interaction.editReply({
					content: "I do not have valid permissions for this action",
				});
				return;
			}
			if (me.roles.highest.comparePositionTo(role) <= 0) {
				interaction.editReply({
					content:
						"The role is higher than my own roles, so I cannot do that",
				});
				return;
			}
			let successes = 0;
			let failures = 0;
			const promises = [];
			for (const channel_ of await guild.channels.fetch()) {
				const channel = channel_[1];
				if (
					channel?.type === Discord.ChannelType.GuildText &&
					me.permissionsIn(channel).has(BOT_PERMS)
				) {
					promises.push(
						channel.permissionOverwrites.edit(role, {
							SendMessages: false,
							AddReactions: false,
							UseApplicationCommands: false,
							CreatePrivateThreads: false,
							CreatePublicThreads: false,
						})
					);
				} else {
					failures += 1;
				}
			}
			for (const p of promises) {
				await p
					.then(() => (successes += 1))
					.catch(() => (failures += 1));
			}
			await interaction.editReply({
				content: `Succeeded for ${successes} channels, failed for ${failures} channels. Please view the server as the role to see if the result is correct.`,
			});
		},
	},
	{
		name: "createcaptcha",
		description: "Creates a captcha that removes a specified role",
		kind: CmdKind.SLASH,
		options: [
			{
				name: "role",
				description:
					"Role that should be removed when the user completes the captcha",
				type: Discord.ApplicationCommandOptionType.Role,
				required: true,
			},
		],
		action: async interaction => {
			await interaction.deferReply({
				ephemeral: false,
			});
			const guild = interaction.guild;
			if (!guild) {
				interaction.editReply("An error occured");
				return;
			}
			const me = await guild.members.fetchMe();
			const interactionRole = interaction.options.getRole("role");
			if (!interactionRole) {
				interaction.editReply("An error occured");
				return;
			}
			const roleId = interactionRole.id;
			const member = interaction.member as Discord.GuildMember;
			if (!member.permissions.has(USER_PERMS)) {
				interaction.editReply({
					content: "Only admins can use these commands",
				});
				return;
			}
			if (!me.permissions.has(BOT_PERMS_CAPTCHA)) {
				interaction.editReply({
					content: "I do not have valid permissions for this action",
				});
				return;
			}
			let step1Role = guild.roles.cache.find(
				x => x.name == "yatty_captcha_step_1"
			);
			if (!step1Role) {
				step1Role = await guild.roles.create({
					name: "yatty_captcha_step_1",
				});
			}
			let step2Role = guild.roles.cache.find(
				x => x.name == "yatty_captcha_step_2"
			);
			if (!step2Role) {
				step2Role = await guild.roles.create({
					name: "yatty_captcha_step_2",
				});
			}
			if (
				me.roles.highest.comparePositionTo(roleId) <= 0 ||
				me.roles.highest.comparePositionTo(step1Role) <= 0 ||
				me.roles.highest.comparePositionTo(step2Role) <= 0
			) {
				interaction.editReply({
					content:
						"The role is higher than my own roles, so I cannot do that",
				});
				return;
			}
			await interaction.editReply({
				content:
					"To regain access to the server, please press the buttons in this order:\n**3** -> **1** -> **2**\nWait for the response after each press.",
				components: [
					{
						type: Discord.ComponentType.ActionRow,
						components: ["1", "2", "3"].map(num => ({
							type: Discord.ComponentType.Button,
							label: num,
							style: Discord.ButtonStyle.Primary,
							custom_id: `captcha_${num}_rmrole_${roleId}`,
						})),
					},
				],
			});
		},
	},
];
