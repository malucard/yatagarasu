import Discord from "discord.js";
import { archivelpCommands } from "./commands/lpcommands/archivelp";
import { moveCommands } from "./commands/lpcommands/movechannel";
import { upgradelpCommands } from "./commands/lpcommands/upgradelp";
import { embedCommands } from "./commands/general/embed";
import { threadpinCommands } from "./commands/general/threadpin";
import * as mafia from "./commands/mafia/mafia";
import { MF_Commands } from "./commands/mysteryfiction/poll-list-commands";

const client = new Discord.Client({
	intents: Discord.GatewayIntentBits.Guilds
		| Discord.GatewayIntentBits.GuildMessages
		| Discord.GatewayIntentBits.GuildMessages
		| Discord.GatewayIntentBits.GuildMessageReactions
		| Discord.GatewayIntentBits.DirectMessages
		| Discord.GatewayIntentBits.DirectMessageReactions

});

export class CombinedSlashCommand implements Discord.ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: Discord.ApplicationCommandOptionData[];
	defaultPermission?: boolean;
	kind?: mafia.CmdKind.SLASH;
	action?: (interaction: Discord.ChatInputCommandInteraction) => unknown;
}

export class CombinedMessageContextCommand implements Discord.MessageApplicationCommandData {
	type: Discord.ApplicationCommandType.Message;
	name: string;
	kind: mafia.CmdKind.MESSAGE_CONTEXT;
	action?: (interaction: Discord.MessageContextMenuCommandInteraction) => unknown;
}

export type CombinedApplicationCommand = CombinedSlashCommand | CombinedMessageContextCommand;

const cmds: (CombinedApplicationCommand | mafia.MafiaCommand)[] = [
	...mafia.cmds,
	...embedCommands,
	...moveCommands,
	...archivelpCommands,
	...upgradelpCommands,
	...MF_Commands,
	...threadpinCommands
];

client.on("ready", async () => {
	console.log(`Connected as ${client.user.tag}`);
	const appcmds = await client.application.commands.fetch();
	for (const command of cmds) {
		const newcmdstr = command.kind !== mafia.CmdKind.MESSAGE_CONTEXT ? command.options?.map(opt => opt.name + opt.description + opt.type).join(", ") : "";
		const appcmd = appcmds.find(x => x.name === command.name);
		if (command.kind !== mafia.CmdKind.TEXT) {
			if (!appcmd) {
				client.application.commands.create(command);
			} else if (newcmdstr !== appcmd.options?.map(opt => opt.name + opt.description + opt.type).join(", ")) {
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

client.on("messageCreate", async msg => {
	const matches = msg.content.match(/^; *([a-z]+)(\s+(.*))?$/);
	if (matches) {
		for (const command of cmds) {
			if (command.name === matches[1]) {
				if (command.kind === undefined || command.kind === mafia.CmdKind.TEXT_OR_SLASH || command.kind === mafia.CmdKind.TEXT) {
					if (!(command instanceof CombinedSlashCommand)) {
						await (command as mafia.MafiaCommandTextOrSlash).action(msg, matches[2]?.trim() || "");
					}
				}
				break;
			}
		}
	}
});

async function resolveApplicationCommand(interaction: Discord.ChatInputCommandInteraction<Discord.CacheType> | Discord.MessageContextMenuCommandInteraction<Discord.CacheType> | Discord.UserContextMenuCommandInteraction<Discord.CacheType>) {
	const command = cmds.find(cmd => cmd.name === interaction.commandName);
	if (!command) {
		console.error("Unknown Interaction", interaction);
	} else if (command.kind === mafia.CmdKind.TEXT_OR_SLASH && interaction.isChatInputCommand()) {
		const args = interaction.options.data.reduce((acc, next) => `${acc} ${next.value}`, "");
		await command.action(interaction, args);
	} else if (command.kind === mafia.CmdKind.SLASH && interaction.isChatInputCommand()) {
		await command.action(interaction);
	} else if (command.kind === mafia.CmdKind.MESSAGE_CONTEXT && interaction.isMessageContextMenuCommand()) {
		await command.action(interaction);
	}
}

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.type === Discord.InteractionType.ApplicationCommand) {
		await resolveApplicationCommand(interaction);
	}
	else if (interaction.isStringSelectMenu() && mafia.select_menus[interaction.customId]) {
		await mafia.select_menus[interaction.customId](interaction);
	}
	else if (interaction.isButton() && mafia.buttons[interaction.customId]) {
		await mafia.buttons[interaction.customId](interaction);
	} else {
		console.error("Unknown interaction", interaction);
	}
});

client.login(process.env["LOGIN_AUTH"]);
