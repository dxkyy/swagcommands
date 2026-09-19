import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { optionObject, commandName } = command;
	const { deferReply } = optionObject;

	if (
		deferReply &&
		typeof deferReply !== "boolean" &&
		(typeof deferReply !== "object" ||
			(deferReply.ephemeral !== undefined &&
				typeof deferReply.ephemeral !== "boolean"))
	) {
		throw new Error(
			`Command "${commandName}" does not have a valid value for "deferReply". Please use a boolean or an options object.`
		);
	}
};
