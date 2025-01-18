import * as Discord from "discord.js";

export async function deathedHandler(
	interaction: Discord.ButtonInteraction<Discord.CacheType>
) {
	const customId = (interaction as Discord.ButtonInteraction).customId;
	const [, buttonNum] = customId.match("captcha_([1-3])_rmrole_([1-9]+)") || [
		"",
		"",
	];
	if (buttonNum === "3") {
		const member = await interaction.guild?.members.fetch(
			interaction.member?.user.id ?? ""
		);
		for (const [, roleToCheck] of member?.roles.cache ?? []) {
			if (roleToCheck.name.startsWith("yatty_captcha_step_")) {
				await member?.roles.remove(roleToCheck);
			}
		}
		const step1Role = interaction.guild?.roles.cache.find(
			x => x.name == "yatty_captcha_step_1"
		);
		step1Role && (await member?.roles.add(step1Role));
		await interaction.reply({
			content: "Accepted. Please press the **1** button now.",
			ephemeral: true,
		});
	} else if (buttonNum === "1") {
		const member = await interaction.guild?.members.fetch(
			interaction.member?.user.id ?? ""
		);
		let denied = false;
		if (!member?.roles.cache.find(x => x.name === "yatty_captcha_step_1")) {
			denied = true;
		}
		for (const [, roleToCheck] of member?.roles.cache ?? []) {
			if (roleToCheck.name.startsWith("yatty_captcha_step_")) {
				await member?.roles.remove(roleToCheck);
			}
		}
		const step2Role = interaction.guild?.roles.cache.find(
			x => x.name == "yatty_captcha_step_2"
		);
		step2Role && (await member?.roles.add(step2Role));
		if (!denied) {
			await interaction.reply({
				content: "Accepted. Please press the **2** button now.",
				ephemeral: true,
			});
		} else {
			await interaction.reply({
				content: "Incorrect input.",
				ephemeral: true,
			});
		}
	} else if (buttonNum === "2") {
		const member = await interaction.guild?.members.fetch(
			interaction.member?.user.id ?? ""
		);
		let denied = false;
		if (!member?.roles.cache.find(x => x.name === "yatty_captcha_step_2")) {
			denied = true;
		}
		for (const [, roleToCheck] of member?.roles.cache ?? []) {
			if (roleToCheck.name.startsWith("yatty_captcha_step_")) {
				await member?.roles.remove(roleToCheck);
			}
		}
		if (!denied) {
			const deathedRole = interaction.guild?.roles.cache.find(
				x => x.name === "deathed"
			);
			deathedRole && (await member?.roles.remove(deathedRole));
			await interaction.reply({
				content: "Accepted.",
				ephemeral: true,
			});
		} else {
			await interaction.reply({
				content: "Incorrect input.",
				ephemeral: true,
			});
		}
	}
}
