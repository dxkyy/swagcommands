import Command from "../../Command";
import {
	CommandInteraction,
	Guild,
	GuildMember,
	Message,
	PermissionFlagsBits,
} from "discord.js";
import requiredPermissionsSchema from "../../../models/required-permissions-schema";

const keys = Object.keys(PermissionFlagsBits);

export const validation = async (
	command: Command,
	usage: any,
	prefix: string
) => {
	const { permissions = [] } = command.commandObject;
	const { member, message, interaction, guild } = usage as {
		member: GuildMember;
		message: Message;
		interaction: CommandInteraction;
		guild: Guild;
	};

	if (!member) return true;

	const document = await requiredPermissionsSchema.findById(
		`${guild.id}-${command.commandName}`
	);
	if (document) {
		for (const permission of document.permissions) {
			if (!permissions.includes(permission)) permissions.push(permission);
		}
	}

	if (permissions.length) {
		const missingPermissions = [];

		for (const permission of permissions) {
			if (!member.permissions.has(permission)) {
				const permissionName = keys.find(
					(key) =>
						key === permission ||
						PermissionFlagsBits[key as keyof typeof PermissionFlagsBits] ===
							permission
				);
				missingPermissions.push(permissionName);
			}
		}

		if (missingPermissions.length) {
			const text = `You are missing the following permissions to perform this action: ${missingPermissions.join(
				", "
			)}`;

			if (message) message.reply(text);
			else if (interaction) interaction.reply(text);

			return false;
		}
	}

	return true;
};
