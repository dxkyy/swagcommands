import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { instance, commandName, optionObject } = command;

	if (optionObject.ownerOnly !== true || instance.botOwners.length) {
		return;
	}

	throw new Error(
		`Subcommand "${commandName}" is a owner only command, but no owners were specified.`
	);
};
