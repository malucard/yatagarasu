import Discord = require("discord.js");
import ChannelManager = require("./ChannelManager");
import Player from "./Player";
import {get_confirm_react, get_error_react} from "./db"

export default class Env {
	players: Player[];
	channel: Discord.TextChannel;
	secret_channel: Discord.TextChannel;
	mafia_player: Discord.Role;

	set_can_speak(channel: Discord.TextChannel, member: Discord.GuildMember | Discord.Role, can: boolean) {
		ChannelManager.set_can_speak(channel, member, can);
	}

	set_can_see(channel: Discord.TextChannel, member: Discord.GuildMember | Discord.Role, can: boolean) {
		ChannelManager.set_can_see(channel, member, can);
	}

	clear_member_overwrites(channel: Discord.TextChannel) {
		ChannelManager.clear_member_overwrites(channel);
	}
	
	get_confirm_react(): string {
		return get_confirm_react();
	}
	
	get_error_react(): string {
		return get_error_react();
	}
	
	get_player(n: number | string) {
		return typeof n === "string"? this.players.find(x => x.id === n): this.players.find(x => x.number === n);
	}
}