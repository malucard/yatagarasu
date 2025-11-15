import * as Discord from "discord.js";
import {
	CmdKind,
	CombinedSlashCommand,
	hiddenReply,
} from "../../utils/helpers";

const BOT_CATEGORY_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.ManageRoles |
	Discord.PermissionFlagsBits.ManageChannels;
const USER_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.ManageChannels;
const LP_LIST_PERMS =
	Discord.PermissionFlagsBits.ViewChannel |
	Discord.PermissionFlagsBits.SendMessages;

export const createLpCommands: CombinedSlashCommand[] = [
	{
		name: "createlp",
		description: "Create a new LP channel",
		kind: CmdKind.SLASH,
		options: [
			{
				type: Discord.ApplicationCommandOptionType.String,
				name: "name",
				description: "Name of the LP channel",
				required: true,
			},
			{
				type: Discord.ApplicationCommandOptionType.User,
				name: "lper",
				description: "User who will be LPing",
				required: true,
			},
			{
				type: Discord.ApplicationCommandOptionType.Channel,
				name: "category",
				description: "Category to create the LP channel in",
				required: true,
				channelTypes: [Discord.ChannelType.GuildCategory],
			},
			{
				type: Discord.ApplicationCommandOptionType.Boolean,
				name: "private",
				description: "Whether the LP channel should be private",
				required: false,
			},
			{
				type: Discord.ApplicationCommandOptionType.Role,
				name: "role1",
				description: "Roles to give access to the LP channel",
				required: false,
			},
			{
				type: Discord.ApplicationCommandOptionType.Role,
				name: "role2",
				description: "Roles to give access to the LP channel",
				required: false,
			},
			{
				type: Discord.ApplicationCommandOptionType.Role,
				name: "role3",
				description: "Roles to give access to the LP channel",
				required: false,
			},
			{
				type: Discord.ApplicationCommandOptionType.Role,
				name: "role4",
				description: "Roles to give access to the LP channel",
				required: false,
			},
		],
		action: async interaction => {
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
			const name = interaction.options.getString("name");
			// assert name is of form "lp-<game>-<lper>"
			if (!name || !name.match(/^lp-[a-z0-9-]+-[a-z0-9-]+$/i)) {
				hiddenReply(interaction, "Invalid LP channel name");
				console.error("Invalid LP channel name");
				return;
			}
			const lper = interaction.options.getUser("lper");
			const category =
				interaction.options.getChannel<Discord.ChannelType.GuildCategory>(
					"category"
				);
			const isPrivate =
				interaction.options.getBoolean("private") ?? false;
			const role1 = interaction.options.getRole("role1");
			const role2 = interaction.options.getRole("role2");
			const role3 = interaction.options.getRole("role3");
			const role4 = interaction.options.getRole("role4");
			if (!name || !lper || !category) {
				hiddenReply(interaction, "An error occured");
				console.error("Missing required options");
				return;
			}
			const me = await guild.members.fetchMe();
			if (!category.permissionsFor(me)?.has(BOT_CATEGORY_PERMS)) {
				hiddenReply(
					interaction,
					"I don't have the required permissions in the category"
				);
				console.error("Missing category permissions");
				return;
			}
			if (!category.permissionsFor(member)?.has(USER_PERMS)) {
				hiddenReply(
					interaction,
					"You don't have the required permissions in the category"
				);
				console.error("Missing user permissions");
				return;
			}
			// create the channel
			const channel = await guild.channels.create({
				name,
				type: Discord.ChannelType.GuildText,
				parent: category,
			});
			if (!channel) {
				hiddenReply(
					interaction,
					"An error occured while creating the channel"
				);
				console.error("Channel not created");
				return;
			}
			const lpList = guild.channels.cache.find(
				c =>
					c.name === "lp-list" &&
					c.type === Discord.ChannelType.GuildText
			) as Discord.TextChannel;
			await interaction.reply({
				content: `LP channel ${channel} created`,
				ephemeral: Boolean(lpList),
			});
			// set channel permissions
			await channel.permissionOverwrites.create(
				lper.id,
				{
					ViewChannel: true,
					PinMessages: true,
				},
				{ type: Discord.OverwriteType.Member }
			);
			isPrivate &&
				(await channel.permissionOverwrites.create(
					guild.roles.everyone.id,
					{
						ViewChannel: false,
					},
					{
						type: Discord.OverwriteType.Role,
						reason: "Private LP channel",
					}
				));
			// add roles to the channel
			const roles = [role1, role2, role3, role4].filter(Boolean);
			for (const role of roles) {
				await channel.permissionOverwrites.create(
					role.id,
					{
						ViewChannel: true,
					},
					{
						type: Discord.OverwriteType.Role,
					}
				);
			}
			// update LP list
			const lpListMessage = `**${name}** - ${channel.toString()} - was created for ${lper.toString()} by ${user.toString()}`;
			if (
				lpList &&
				lpList instanceof Discord.TextChannel &&
				me?.permissionsIn(lpList).has(LP_LIST_PERMS)
			) {
				await lpList.messages.fetch();
				if (lpList.lastMessage?.member.id === me.id) {
					const oldContent = lpList.lastMessage.content;
					lpList.lastMessage.edit(
						[oldContent, lpListMessage].join("\n\n")
					);
				} else {
					lpList.send(lpListMessage);
				}
			}
			await channel.send(
				`LP Channel created by ${user.toString()} for ${lper.toString()}`
			);
		},
	},
];
