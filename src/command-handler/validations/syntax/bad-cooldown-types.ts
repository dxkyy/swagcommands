import Command from "../../Command";
import { cooldownTypes } from "../../../util/Cooldowns";

export const validation = (command: Command) => {
	const { commandObject, commandName } = command;
	if (!commandObject.cooldowns) return;

	let counter = 0;
	for (const type of cooldownTypes) {
		if (commandObject.cooldowns[type]) ++counter;
	}

	if (counter === 0)
		throw new Error(
			`Command "${commandName}" does have a cooldown object, but no cooldown types were specified. Please use one of the following: ${cooldownTypes}`
		);
	if (counter > 1)
		throw new Error(
			`Command "${commandName}" has multiple cooldown types, you must specify only one.`
		);
};
