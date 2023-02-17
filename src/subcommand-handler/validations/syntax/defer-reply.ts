import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { optionObject, commandName } = command;
	const { deferReply } = optionObject;

	if (
		deferReply &&
		typeof deferReply !== "boolean" &&
		deferReply !== "ephemeral"
	) {
		throw new Error(
			`Command "${commandName}" does not have a valid value for "deferReply". Please use a boolean value or "ephemeral".`
		);
	}
};
