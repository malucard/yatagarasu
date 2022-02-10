import Discord = require("discord.js");
import {MongoClient, Collection} from "mongodb";

let client: MongoClient;
let collection: Collection;
export let config_db: {[name: string]: any};
export let roles_db: {[name: string]: any};

export function init_db() {
	client = new MongoClient("mongodb://yatagarasu-mafia-bot:LKsg2x25cN4jf8bU@yatagarasu-mafia-shard-00-00-uwyry.mongodb.net:27017,yatagarasu-mafia-shard-00-01-uwyry.mongodb.net:27017,yatagarasu-mafia-shard-00-02-uwyry.mongodb.net:27017/test?ssl=true&replicaSet=yatagarasu-mafia-shard-0&authSource=admin&retryWrites=true&w=majority",
		{useNewUrlParser: true});
	client.connect(async err => {
		if(err) {
			client.close();
			throw "Failed to connect to MongoDB server: " + err.message;
		}
		console.log("Connected to MongoDB");
		let db = client.db("mafia");
		db.collection("config").find().toArray((err, res) => {
			config_db = res[0];
		});
		db.collection("roles").find().toArray((err, res) => {
			roles_db = res[0];
		});
	});
}

export function save_roles() {
	collection.updateOne({}, {$set: roles_db});
}

export async function get_db(channel: Discord.TextChannel) {
	let i = channel.topic.indexOf("mafiadb");
	let id = channel.topic.substr(i + 7, 18);
	let db = await channel.fetchMessage(id);
	db.content.match(/()/)
}

export function random_in(arr: any[]): any {
	return arr[Math.floor(Math.random() * arr.length)];
}

export function get_confirm_react(): string {
	return random_in(config_db.confirm_react.split("|"));
}

export function get_error_react(): string {
	return random_in(config_db.error_react.split("|"));
}

export function get_player_role(guild: Discord.Guild): Discord.Role {
	return guild.roles.find(x => x.name === config_db.player_role);
}

export function has_perms(member: Discord.GuildMember): boolean {
	return member.roles.find(x => x.name === config_db.manager_role)? true: false;
}

export function is_mafia_channel(channel: Discord.TextChannel): boolean {
	let channel_role = channel.guild.roles.find(x => x.name === config_db.channel_role);
	return channel_role && channel.permissionOverwrites.find(x => x.type === "role" && x.id === channel_role.id)? true: false;
}

export function get_secret_channel(guild: Discord.Guild): Discord.TextChannel {
	return guild.channels.find(x => x.name === config_db.secret_channel && x.type === "text") as Discord.TextChannel;
}