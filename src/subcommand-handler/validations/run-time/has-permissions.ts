import { PermissionFlagsBits } from "discord.js";
import SubcommandOption from "../../SubcommandOption";
import { CommandUsage } from "../../../../typings";

const keys = Object.keys(PermissionFlagsBits);

export default async (command: SubcommandOption, usage: CommandUsage) => {
	const { permissions = [] } = command.optionObject;
	const { instance, guild, member, message, interaction } = usage;

	if (!member) {
		return true;
	}

	if (permissions.length) {
		const missingPermissions = [];

		for (const permission of permissions) {
			// @ts-ignore
			if (!member.permissions.has(permission)) {
				const permissionName = keys.find(
					// @ts-ignore
					(key) => key === permission || PermissionFlagsBits[key] === permission
				);
				missingPermissions.push(permissionName);
			}
		}

		if (missingPermissions.length) {
			const text = `You are missing the following permissions to perform this action: \`${missingPermissions.join(
				'", "'
			)}\``;

				if (message) {
					await instance.responseHandler.respondToMessage(message, text, true, {
						commandName: command.commandName,
						invocationKind: "message",
					});
				} else if (interaction) {
					await instance.responseHandler.respondToInteraction(interaction, text, {
						commandName: command.commandName,
						invocationKind: "interaction",
					});
				}

			return false;
		}
	}

	return true;
};
