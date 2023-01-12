import Command from "../../Command";

export const validation = async (command: Command, usage: any) => {
	const { commandName, instance } = command;
	const { guild, channel, message, interaction } = usage;

	if (!guild) return true;

	const availableChannels = await instance.commandHandler?.channelCommands.getAvailableChannels(
		guild.id,
		commandName
	);

	if (availableChannels.length && !availableChannels.includes(channel.id)) {
		const reply = `You can only run this command inside of the following channels: ${availableChannels.map(
			(c: any) => `<#${c}> `
		)}`;

		if (message) message.reply(reply);
		else if (interaction) interaction.reply(reply);

		return false;
	}

	return true;
};
