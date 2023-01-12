import Command from "../../Command";
import requiredRolesSchema from "../../../models/required-roles-schema";

export const validation = async (
	command: Command,
	usage: any,
	prefix: string
) => {
	const { member, guild, message, interaction } = usage;

	if (!member) return true;

	const _id = `${guild.id}-${command.commandName}`;
	const document = await requiredRolesSchema.findById(_id);

	if (document) {
		let hasRole = false;

		for (const roleId of document.roles) {
			if (member.roles.cache.has(roleId)) {
				hasRole = true;
				break;
			}
		}

		if (hasRole) return true;

		const reply = {
			content: `You need one of these roles: ${document.roles.map(
				(role: any) => `<@&${role}>`
			)}`,
			allowedMentions: {
				roles: [],
			},
		};

		if (message) message.reply(reply);
		else if (interaction) interaction.reply(reply);

		return false;
	}

	return true;
};
