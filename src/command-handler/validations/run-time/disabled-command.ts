import Command from "../../Command";

export const validation = async (command: Command, usage: any) => {
	const { commandName, instance } = command;
	const { guild, message, interaction } = usage;

	if (!guild) return true;

	if (
		instance.commandHandler?.disabledCommands.isDisabled(guild.id, commandName)
	) {
		const text = `This command has been disabled for this guild.`;

		if (message) message.reply(text);
		else if (interaction) interaction.reply(text);

		return false;
	}

	return true;
};
