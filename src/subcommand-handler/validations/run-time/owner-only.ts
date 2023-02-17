import SubcommandOption from "../../SubcommandOption";
import { CommandUsage } from "../../../../typings";

export default (command: SubcommandOption, usage: CommandUsage) => {
	const { instance, optionObject } = command;
	const { botOwners } = instance;
	const { ownerOnly } = optionObject;
	const { user } = usage;

	if (ownerOnly === true && !botOwners.includes(user!.id)) {
		return false;
	}

	return true;
};
