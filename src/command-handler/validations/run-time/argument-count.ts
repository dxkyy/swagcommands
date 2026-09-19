import Command from "../../Command";

export default async (command: Command, usage: any, prefix: string) => {
	const {
		minArgs = 0,
		maxArgs = -1,
		expectedArgs = "",
	} = command.commandObject;
	const { length } = usage.args;

	if (length < minArgs || (length > maxArgs && maxArgs !== -1)) {
		const text = `Incorrect syntax! Please use \`${prefix}${command.commandName} ${expectedArgs}\``;

			const { instance, message, interaction } = usage;

			if (message) {
				await instance.responseHandler.respondToMessage(message, text, true, {
					commandName: command.commandName,
					invocationKind: "message",
				});
			} else if (interaction) {
				await instance.responseHandler.respondToInteraction(interaction, text, {
					commandName: command.commandName,
					invocationKind: "interaction",
				});
			}

		return false;
	}

	return true;
};
