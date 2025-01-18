import * as Discord from "discord.js";
import * as mafia from "./commands/mafia/mafia";
import { MF_Commands } from "./commands/mysteryfiction/poll-list-commands";
import {
	CmdKind,
	CombinedApplicationCommand,
	hiddenReply,
} from "./utils/helpers";
import {
	categoryCommands,
	embedCommands,
	threadpinCommands,
	securityCommands,
} from "./commands/general";
import {
	moveCommands,
	archivelpCommands,
	upgradelpCommands,
	createLpCommands,
} from "./commands/lpcommands";
import { deathedHandler } from "./utils/deathed";

const client = new Discord.Client({
	intents:
		Discord.GatewayIntentBits.Guilds |
		Discord.GatewayIntentBits.GuildMessages |
		Discord.GatewayIntentBits.GuildMessageReactions |
		Discord.GatewayIntentBits.DirectMessages |
		Discord.GatewayIntentBits.DirectMessageReactions,
	partials: [Discord.Partials.Message, Discord.Partials.Reaction],
});

const cmds: (CombinedApplicationCommand | mafia.MafiaCommand)[] = [
	...mafia.cmds,
	...embedCommands,
	...moveCommands,
	...createLpCommands,
	...archivelpCommands,
	...upgradelpCommands,
	...MF_Commands,
	...threadpinCommands,
	...categoryCommands,
	...securityCommands,
];

client.on("ready", async () => {
	console.log(`Connected as ${client?.user?.tag}`);
	const appcmds = await client.application?.commands.fetch();
	for (const command of cmds) {
		const newcmdstr =
			command.kind !== CmdKind.MESSAGE_CONTEXT
				? command.options
						?.map(opt => opt.name + opt.description + opt.type)
						.join(", ")
				: "";
		const appcmd = appcmds?.find(x => x.name === command.name);
		if (command.kind !== CmdKind.TEXT) {
			if (!appcmd) {
				client.application?.commands.create(command);
			} else if (
				newcmdstr !==
				appcmd.options
					?.map(opt => opt.name + opt.description + opt.type)
					.join(", ")
			) {
				appcmd.edit(command);
			}
		} else {
			if (appcmd) appcmd.delete();
		}
	}
	console.log("Application commands prepared");
});

client.on("error", error => {
	console.error(error.message);
});

client.on("messageReactionAdd", async (reaction, user) => {
	if (
		reaction.message.id == "1224789493899591771" &&
		reaction.message.channel.isTextBased()
	) {
		if (user.partial) {
			user = await user.fetch();
		}
		const member = reaction.message.guild?.members.resolve(user.id);
		await member?.roles.add("1224548316285763584", "instant death button");
	} else if (
		reaction.message.id == "1224789666725761084" &&
		reaction.message.channel.isTextBased()
	) {
		if (user.partial) {
			user = await user.fetch();
		}
		const member = reaction.message.guild?.members.resolve(user.id);
		await member?.roles.add("1224753960179728445", "instant death button");
	}
});

async function resolveApplicationCommand(
	interaction:
		| Discord.ChatInputCommandInteraction<Discord.CacheType>
		| Discord.MessageContextMenuCommandInteraction<Discord.CacheType>
		| Discord.UserContextMenuCommandInteraction<Discord.CacheType>
) {
	const command = cmds.find(cmd => cmd.name === interaction.commandName);
	if (!command) {
		console.error("Unknown Interaction", interaction);
	} else if (
		command.kind === CmdKind.TEXT_OR_SLASH &&
		interaction.isChatInputCommand()
	) {
		const args = interaction.options.data.reduce(
			(acc, next) => `${acc} ${next.value}`,
			""
		);
		await command.action(interaction, args);
	} else if (
		command.kind === CmdKind.SLASH &&
		interaction.isChatInputCommand()
	) {
		await command.action?.(interaction);
	} else if (
		command.kind === CmdKind.MESSAGE_CONTEXT &&
		interaction.isMessageContextMenuCommand()
	) {
		await command.action?.(interaction);
	} else {
		console.error("Unknown Interaction", interaction);
		hiddenReply(interaction, "Unknown Interaction");
	}
}

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	try {
		if (interaction.type === Discord.InteractionType.ApplicationCommand) {
			await resolveApplicationCommand(interaction);
		} else if (
			interaction.isStringSelectMenu() &&
			mafia.select_menus[interaction.customId]
		) {
			await mafia.select_menus[interaction.customId](interaction);
		} else if (
			interaction.isButton() &&
			mafia.buttons[interaction.customId]
		) {
			await mafia.buttons[interaction.customId](interaction);
		} else if (
			interaction.isButton() &&
			(interaction as Discord.ButtonInteraction).customId.startsWith(
				"captcha_"
			)
		) {
			await deathedHandler(interaction);
		} else {
			console.error("Unknown interaction", interaction);
		}
	} catch (error) {
		console.error(error, interaction);
	}
});

client.login(process.env["LOGIN_AUTH"]);
