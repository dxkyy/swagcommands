import Command from "../../Command";

export const validation = (command: Command, usage: any, prefix: string) => {
	const { instance, commandObject } = command;
	const { guild } = usage;

	if (commandObject.testOnly !== true) return true;

	return instance.testServers.includes(guild?.id);
};
