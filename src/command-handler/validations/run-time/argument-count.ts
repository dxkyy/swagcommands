import Command from "../../Command";

export const validation = (command: Command, usage: any, prefix: string) => {
	const {
		minArgs = 0,
		maxArgs = -1,
		expectedArgs = "",
	} = command.commandObject;
	const { length } = usage.args;

	if (length < minArgs || (length > maxArgs && maxArgs !== -1)) {
		const text = `Incorrect syntax! Please use \`${prefix}${command.commandName} ${expectedArgs}\``;

		const { message, interaction } = usage;

		if (message) message.reply(text);
		else if (interaction) interaction.reply(text);

		return false;
	}

	return true;
};
