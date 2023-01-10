import Command from "../../Command";

export const validation = (command: Command) => {
	const { instance, commandName, commandObject } = command;

	if (commandObject.testOnly !== true || instance.testServers.length) return;

	throw new Error(
		`Command "${commandName}" is a testOnly command, but no test servers were specified.`
	);
};
