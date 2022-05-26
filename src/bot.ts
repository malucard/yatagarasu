import Discord from "discord.js";
import { buttons, cmds, MafiaCommandTextOrSlash, select_menus } from "./commands/mafia/mafia";

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

export enum CmdKind {
	TEXT_OR_SLASH,
	TEXT,
	SLASH,
	MESSAGE_CONTEXT
}

export class CombinedApplicationCommand implements Discord.ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: Discord.ApplicationCommandOptionData[];
	defaultPermission?: boolean;
	kind?: CmdKind;
	action?: (interaction: Discord.CommandInteraction) => any;
}

client.on("ready", async () => {
	console.log(`Connected as ${client.user.tag}`);
	const appcmds = await client.application.commands.fetch();
	for (const command of cmds) {
		const newcmdstr = command.options?.map(opt => opt.name + opt.description + opt.type).join(", ");
		const appcmd = appcmds.find(x => x.name === command.name);
		if (command.kind !== CmdKind.TEXT) {
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
				if (command.kind === undefined || command.kind === CmdKind.TEXT_OR_SLASH || command.kind === CmdKind.TEXT) {
					await (command as MafiaCommandTextOrSlash).action(msg, matches[2]?.trim() || "");
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
				if (command.kind === undefined || command.kind === CmdKind.TEXT_OR_SLASH || command.kind === CmdKind.SLASH) {
					const args = interaction.options.data.map(opt => opt.value.toString()).join(" ");
					await (command as MafiaCommandTextOrSlash).action(interaction as Discord.CommandInteraction, args);
				}
				break;
			}
		}
	}
	if (interaction.isSelectMenu() && select_menus[interaction.customId]) {
		await select_menus[interaction.customId](interaction);
	}
	if (interaction.isButton() && buttons[interaction.customId]) {
		await buttons[interaction.customId](interaction);
	}
});

client.login(process.env["LOGIN_AUTH"]);
