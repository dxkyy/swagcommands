import Command from "../../Command";

export const validation = (command: Command) => {
	const { instance, commandName, commandObject } = command;

	if (commandObject.ownerOnly !== true || instance.botOwners.length) return;

	throw new Error(
		`Command "${commandName}" is a ownerOnly command, but no bot owners were specified.`
	);
};
