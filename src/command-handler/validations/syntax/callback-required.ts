import Command from "../../Command";

export const validation = (command: Command) => {
	const { commandObject, commandName } = command;
	if (!commandObject.callback) {
		throw new Error(`Command "${commandName}" does not have a callback`);
	}
};
