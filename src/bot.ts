import Discord from "discord.js";
import { archivelpCommands } from "./commands/lpcommands/archivelp";
import { moveCommands } from "./commands/lpcommands/movechannel";
import { upgradelpCommands } from "./commands/lpcommands/upgradelp";
import { embedCommands } from "./commands/general/embed";
import { threadpinCommands } from "./commands/general/threadpin";
import * as mafia from "./commands/mafia/mafia";
import { MF_Commands } from "./commands/mysteryfiction/poll-list-commands";

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Discord.Intents.FLAGS.DIRECT_MESSAGES,
		Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
	]
});

export class CombinedSlashCommand implements Discord.ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: (Discord.ApplicationCommandOptionData)[];
	defaultPermission?: boolean;
	kind?: mafia.CmdKind.SLASH;
	action?: (interaction: Discord.CommandInteraction) => unknown;
}

export class CombinedMessageContextCommand implements Discord.MessageApplicationCommandData {
	type: "MESSAGE";
	name: string;
	kind: mafia.CmdKind.MESSAGE_CONTEXT;
	action?: (interaction: Discord.MessageContextMenuInteraction) => unknown;
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

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.isApplicationCommand() || interaction.isCommand() || interaction.isMessageContextMenu()) {
		for (const command of cmds) {
			if (command.name === interaction.commandName) {
				if (command.kind === undefined || command.kind === mafia.CmdKind.TEXT_OR_SLASH || command.kind === mafia.CmdKind.SLASH) {
					if (command.kind === mafia.CmdKind.SLASH && interaction.isCommand()) {
						command.action(interaction);
					} else {
						const args = interaction.options.data.map(opt => opt.value.toString()).join(" ");
						await (command as mafia.MafiaCommandTextOrSlash).action(interaction as Discord.CommandInteraction, args);
					}
				} else if (command.kind === mafia.CmdKind.MESSAGE_CONTEXT) {
					if(interaction.isMessageContextMenu()) {
						command.action(interaction);
					}
				}
				break;
			}
		}
	}
	else if (interaction.isSelectMenu() && mafia.select_menus[interaction.customId]) {
		await mafia.select_menus[interaction.customId](interaction);
	}
	else if (interaction.isButton() && mafia.buttons[interaction.customId]) {
		await mafia.buttons[interaction.customId](interaction);
	} else {
		console.error("Unknown interaction", interaction);
	}
});

client.login(process.env["LOGIN_AUTH"]);
