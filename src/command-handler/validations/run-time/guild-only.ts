import Command from "../../Command";

export const validation = (command: Command, usage: any, prefix: string) => {
	const { guildOnly } = command.commandObject;
	const { guild, message, interaction } = usage;

	if (guildOnly === true && !guild) {
		/* const text = "This command can only be run in a guild/server.";

        if (message) message.reply(text);
        else if (interaction) interaction.reply(text) */
		return false;
	}

	return true;
};
