import {
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	PermissionFlagsBits,
} from "discord.js";
import SWAGCommands from "../..";
import requiredPermissionsSchema from "../../models/required-permissions-schema";
import { ICallback } from "../../types";
import Command from "../Command";

const clearAllPermission = "Clear All Permissions";

export const command = {
	description: "Sets which commands require which permissions.",

	type: "SLASH",
	testOnly: true,
	guildOnly: true,

	permissions: [PermissionFlagsBits.Administrator],

	options: [
		{
			name: "command",
			description: "The command to set permissions for.",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
		{
			name: "permission",
			description: "The permission to set for the command.",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: true,
		},
	] as ApplicationCommandOption[],

	autocomplete: (_: any, command: Command, arg: string) => {
		if (arg === "command") {
			return [...command.instance.commandHandler?.commands.keys()!];
		} else if (arg === "permission")
			return [clearAllPermission, ...Object.keys(PermissionFlagsBits)];
	},

	callback: async ({ instance, guild, args }: ICallback) => {
		const [commandName, permission] = args;

		const command = instance.commandHandler?.commands.get(commandName);
		if (!command) return `The command "${commandName}" does not exist.`;

		const _id = `${guild.id}-${command.commandName}`;

		if (!permission) {
			const document = await requiredPermissionsSchema.findById(_id);

			const permissions =
				document && document.permissions?.length
					? document.permissions.join(", ")
					: "None.";

			return `Here are the permissions for "${commandName}": ${permissions}`;
		}

		if (permission === clearAllPermission) {
			await requiredPermissionsSchema.deleteOne({ _id });

			return `The Command "${commandName}" no longer requires any permissions.`;
		}

		const alreadyExists = await requiredPermissionsSchema.findOne({
			_id,
			permissions: {
				$in: [permission],
			},
		});

		if (alreadyExists) {
			await requiredPermissionsSchema.findOneAndUpdate(
				{ _id },
				{ _id, $pull: { permissions: permission } }
			);

			return `The command "${commandName}" no longer requires the permission "${permission}".`;
		}

		await requiredPermissionsSchema.findOneAndUpdate(
			{ _id },
			{ _id, $addToSet: { permissions: permission } },
			{ upsert: true }
		);

		return `The command "${commandName}" now requires ${permission}.`;
	},
};
