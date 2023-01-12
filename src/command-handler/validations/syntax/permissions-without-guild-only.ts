import Command from "../../Command";

export const validation = (command: Command) => {
	const { commandName, commandObject } = command;
	const { guildOnly, permissions = [] } = commandObject;

	if (guildOnly !== true && permissions.length) {
		throw new Error(
			`Command "${commandName}" is not a guild only command, but permissions are specified.`
		);
	}
};
