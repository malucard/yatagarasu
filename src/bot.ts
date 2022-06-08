import Discord from "discord.js";
import { archivelpCommands } from "./commands/lpcommands/archivelp";
import { upgradelpCommands } from "./commands/lpcommands/upgradelp";
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

export class CombinedApplicationCommand implements Discord.ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: Discord.ApplicationCommandOptionData[];
	defaultPermission?: boolean;
	kind?: mafia.CmdKind.SLASH;
	action?: (interaction: Discord.CommandInteraction) => any;
}

const cmds: (CombinedApplicationCommand | mafia.MafiaCommand)[] = [
	// ...mafia.cmds,
	// ...archivelpCommands,
	// ...upgradelpCommands,
	...MF_Commands,
];

client.on("ready", async () => {
	console.log(`Connected as ${client.user.tag}`);
	const appcmds = await client.application.commands.fetch();
	for (const command of cmds) {
		const newcmdstr = command.options?.map(opt => opt.name + opt.description + opt.type).join(", ");
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
					if (!(command instanceof CombinedApplicationCommand)) {
						await (command as mafia.MafiaCommandTextOrSlash).action(msg, matches[2]?.trim() || "");
					}
				}
				break;
			}
		}
	}
});

client.on("interactionCreate", async interaction => {
	if (interaction.isApplicationCommand() || interaction.isCommand()) {
		for (const command of cmds) {
			if (command.name === interaction.commandName) {
				if (command.kind === undefined || command.kind === mafia.CmdKind.TEXT_OR_SLASH || command.kind === mafia.CmdKind.SLASH) {
					if (command instanceof CombinedApplicationCommand) {
						command.action(interaction as Discord.CommandInteraction);
					} else {
						const args = interaction.options.data.map(opt => opt.value.toString()).join(" ");
						await (command as mafia.MafiaCommandTextOrSlash).action(interaction as Discord.CommandInteraction, args);
					}
				}
				break;
			}
		}
	}
	if (interaction.isSelectMenu() && mafia.select_menus[interaction.customId]) {
		await mafia.select_menus[interaction.customId](interaction);
	}
	if (interaction.isButton() && mafia.buttons[interaction.customId]) {
		await mafia.buttons[interaction.customId](interaction);
	}
});

client.login(process.env["LOGIN_AUTH"]);
