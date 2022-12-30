// File to create commands for upgradeLP / command

import { CommandInteraction, GuildMember, TextChannel } from "discord.js";
import { ApplicationCommandOptionTypes, ChannelTypes } from "discord.js/typings/enums";
import { CombinedSlashCommand } from "../../bot";
import { FLAGS, hiddenReply } from "../../utils/helpers";

/**
 * Upgradable LP names under each role.
 * If the role is single word, add - before and after for safety.
 */
const roleLP_Map: { [key: string]: string[] } = {
	Umineko: [
		"umineko-ep1",
		"umineko-ep2",
		"umineko-ep3",
		"umineko-ep4",
		"umineko-ep5",
		"umineko-ep6",
		"umineko-ep7",
		"umineko-ep8",
	],
	Higurashi: [
		"higurashi-ch1",
		"higurashi-ch2",
		"higurashi-ch3",
		"higurashi-ch4",
		"higurashi-ch5",
		"higurashi-ch6",
		"higurashi-ch7",
		"higurashi-ch8",
	],
	"25th Ward": [
		"-silver-case-",
		"-fsr-",
		"-25th-ward-",
	],
	"PL-trilogy": [
		"pl-cv",
		"pl-db",
		"pl-uf",
	],
	"AA-trilogy": [
		"pw-aa",
		"aa-jfa",
		"aa-tat",
	],
	"AA-spin": [
		"-aai-",
		"-aai2-",
	],
	"AA-main": [
		"aa-dd",
		"aa-soj"
	],
	"PL-all": [
		"-pl-ls-",
		"-pl-ed-",
		"-pl-mm-",
		"-pl-al-",
		"-lmj-"
	],
	DR3: [
		"-dr-udg-",
		"-dr3-",
	],
	Infinity: [
		"-n7-",
		"-e17-",
		"-r11-",
		"-12r-",
	]
};

const USER_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.MANAGE_MESSAGES | FLAGS.SEND_MESSAGES; // Remove manage_channels if we want to let LPer upgrade
const BOT_PERMS = FLAGS.MANAGE_CHANNELS | FLAGS.SEND_MESSAGES;

export const upgradelpCommands: CombinedSlashCommand[] = [{
	name: "upgradelp",
	description: "Upgrade the LP to the next game, if applicable and registered",
	options: [{
		name: "channel",
		description: "Channel to upgrade, defaults to current channel",
		type: ApplicationCommandOptionTypes.CHANNEL,
		channelTypes: [ChannelTypes.GUILD_TEXT],
		required: false
	}],
	action: async (interaction: CommandInteraction) => {
		const usedChannel = interaction.channel;
		const targetChannel = interaction.options.getChannel("channel", false);
		let channel: TextChannel;
		if (targetChannel instanceof TextChannel) {
			channel = targetChannel;
		} else if (targetChannel) {
			hiddenReply(interaction, `${targetChannel.toString()} is not a text channel.`);
			return;
		} else if (usedChannel instanceof TextChannel) {
			channel = usedChannel;
		} else if (usedChannel) {
			hiddenReply(interaction, `${usedChannel.toString()} is not a text channel.`);
			return;
		} else return;
		const member = interaction.member;
		const guild = interaction.guild;
		const me = guild?.me;
		if (me && member instanceof GuildMember && channel.permissionsFor(member).has(USER_PERMS)) {
			if (!channel.permissionsFor(me).has(BOT_PERMS)) {
				hiddenReply(interaction, "Bot does not have valid perms.");
				return;
			}
		} else {
			hiddenReply(interaction, "You are not allowed to use this command.");
			return;
		}
		for (const matchList of Object.values(roleLP_Map)) {
			const matches = matchList.filter(match => channel.name.includes(match)).map(match => matchList.indexOf(match));
			if (!matches.length) {
				continue;
			}
			if (matches.length === 1 && matches[0] === matchList.length - 1) {
				hiddenReply(interaction, "This LP cannot be upgraded further.");
				return;
			} else if (matches.length === 1) {
				const index = matches[0];
				const actuallyDoIt = true;
				if (actuallyDoIt) {
					const oldName = new String(channel.name).toString();
					channel = await channel.setName(channel.name.replace(matchList[index], matchList[index + 1]));
					interaction.reply(`LP Upgraded to ${channel.name} from ${oldName}`);
					return;
				} else {
					const oldName = channel.name.toString();
					const newName = channel.name.replace(matchList[index], matchList[index + 1]);
					hiddenReply(interaction, `LP would be upgraded to ${newName} from ${oldName}`);
					return;
				}
			} else if (matches.length) {
				hiddenReply(interaction, "Unclear which upgrade to perform on this LP.");
				return;
			}
		}
		hiddenReply(interaction, "This is not an upgradable LP");
	}
}];