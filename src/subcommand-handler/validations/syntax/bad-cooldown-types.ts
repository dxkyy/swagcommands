import SubcommandOption from "../../SubcommandOption";

export default (command: SubcommandOption) => {
	const { optionObject, commandName } = command;
	if (!optionObject.cooldowns) return;
	const { cooldowns } = optionObject;

	if (!cooldowns) {
		return;
	}

	if (!cooldowns.type || !cooldowns.duration) {
		throw new Error(
			`Invalid cooldown for subcommand "${commandName}". It must have a "type" and "duration" property.`
		);
	}
};
