import { PermissionFlagsBits } from "discord.js";
import { ICallback } from "../../types";

export const command = {
	description: "Sets the prefix for this server.",

	minArgs: 1,
	expectedArgs: "<prefix>",

	type: "BOTH",
	testOnly: true,
	guildOnly: true,

	permissions: [PermissionFlagsBits.Administrator],

	callback: ({ instance, guild, text: prefix }: ICallback) => {
		instance.commandHandler?.prefixHandler.set(guild.id, prefix);

		return `Set \`${prefix}\` as the command prefix for this server.`;
	},
};
