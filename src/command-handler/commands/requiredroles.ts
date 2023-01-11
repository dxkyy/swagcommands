import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	PermissionFlagsBits,
} from "discord.js";
import requiredRolesSchema from "../../models/required-roles-schema";
import { ICallback } from "../../types";
import Command from "../Command";

export const command = {
	description: "Sets which commands require which roles.",

	type: "SLASH",
	testOnly: true,
	guildOnly: true,

	roles: [PermissionFlagsBits.Administrator],

	options: [
		{
			name: "command",
			description: "The command to set roles for.",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
		{
			name: "role",
			description: "The role to set for the command.",
			type: ApplicationCommandOptionType.Role,
			required: false,
		},
	] as ApplicationCommandOption[],

	autocomplete: (_: any, command: Command) => {
		return [...command.instance.commandHandler?.commands.keys()!];
	},

	callback: async ({ instance, guild, args }: ICallback) => {
		const [commandName, role] = args;

		const command = instance.commandHandler?.commands.get(commandName);
		if (!command) return `The command "${commandName}" does not exist.`;

		const _id = `${guild.id}-${command.commandName}`;

		if (!role) {
			const document = await requiredRolesSchema.findById(_id);

			const roles =
				document && document.roles?.length
					? document.roles.map((role: any) => `<@&${role}>`)
					: "None.";

			return {
				content: `Here are the roles for "${commandName}": ${roles}`,
				allowedMentions: {
					roles: [],
				},
			};
		}

		const alreadyExists = await requiredRolesSchema.findOne({
			_id,
			roles: {
				$in: [role],
			},
		});

		if (alreadyExists) {
			await requiredRolesSchema.findOneAndUpdate(
				{ _id },
				{ _id, $pull: { roles: role } }
			);

			return {
				content: `The command "${commandName}" no longer requires the role <@&${role}>.`,
				allowedMentions: {
					roles: [],
				},
			};
		}

		await requiredRolesSchema.findOneAndUpdate(
			{ _id },
			{ _id, $addToSet: { roles: role } },
			{ upsert: true }
		);

		return {
			content: `The role <@&${role}> has been added to the command "${commandName}".`,
			allowedMentions: {
				roles: [],
			},
		};
	},
};
