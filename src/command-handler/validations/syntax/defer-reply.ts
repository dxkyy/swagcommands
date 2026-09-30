import Command from "../../Command";

export default (command: Command) => {
	const { commandObject, commandName } = command;
	const { deferReply } = commandObject;

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
