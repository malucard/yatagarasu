import Discord = require("discord.js");
import {SetupInstance} from "./Setup";
import {Role, RoleInstance} from "./Role";

export default class Player {
	number: number;
	id: string;
	name: string;
	member: Discord.GuildMember;
	items: string[];
	setup: SetupInstance;
	role: RoleInstance;

	constructor(setup: SetupInstance, number: number, member: Discord.GuildMember, role: Role) {
		this.number = number;
		this.id = member.id;
		this.member = member;
		this.name = member.user.username;
		this.items = [];
		this.setup = setup;
		this.role = role.instance(setup, this);
	}
}