import Command from "../../Command";

export const validation = (command: Command, usage: any, prefix: string) => {
	const { instance, commandObject } = command;
	const { botOwners } = instance;
	const { ownerOnly } = commandObject;
	const { user } = usage;

	if (ownerOnly === true && !botOwners.includes(user.id)) {
		return false;
	}

	return true;
};
