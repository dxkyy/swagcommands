import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { optionObject, commandName } = command;

	if (!optionObject.callback) {
		throw new Error(
			`Subcommand "${commandName}" does not have a callback function.`
		);
	}
};
