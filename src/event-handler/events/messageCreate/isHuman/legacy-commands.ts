import { Message } from "discord.js";

import SWAG from "../../../../../typings";

export default async (message: Message, instance: SWAG) => {
	const { guild, content } = message;

	const { commandHandler } = instance;
	if (!commandHandler) {
		return;
	}

	const { prefixHandler, commands, customCommands } = commandHandler;

	const prefix = prefixHandler.get(guild?.id);
	if (!content.startsWith(prefix) || !message.channel.isSendable()) {
		return;
	}

	const args = content.split(/\s+/);
	let commandName;
	if (prefix.includes(" ")) {
		args[0] = prefix;
	}
	commandName = args
		.shift()!
		.substring(prefix.length)
		.toLowerCase();

	if (prefix.includes(" ")) {
		commandName = args.shift()!.toLowerCase();
	}

	const command = commands.get(commandName);
	if (!command) {
		customCommands.run(commandName, message, null);
		return;
	}

	const { reply, deferReply } = command.commandObject;

	if (deferReply) {
		message.channel.sendTyping();
	}

	const response = await commandHandler.runCommand(
		command,
		args,
		message,
		null
	);
	if (!response) {
		return;
	}

	if (reply) {
		message.reply(response).catch(() => {});
	} else {
		message.channel.send(response).catch(() => {});
	}
};
