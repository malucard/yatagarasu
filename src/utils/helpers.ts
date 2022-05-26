import Discord from "discord.js";

export const FLAGS = Discord.Permissions.FLAGS;

const hiddenReplyContent = (message: string): Discord.InteractionReplyOptions => ({ content: message, ephemeral: true });
export const hiddenReply = (interaction: Discord.CommandInteraction, message: string) => interaction.reply(hiddenReplyContent(message));
