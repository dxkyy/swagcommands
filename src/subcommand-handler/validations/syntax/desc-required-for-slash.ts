import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { commandName, optionObject } = command;

	if (!optionObject.description) {
		throw new Error(
			`Subcommand "${commandName}" is a slash command but does not have a description`
		);
	}
};
