//import { Message } from "discord.js";
import SWAGCommands from "../../../..";
import Command from "../../../../command-handler/Command";
import CommandHandler from "../../../../command-handler/CommandHandler";

export const event = async (message: any, instance: SWAGCommands) => {
	const { content, guild } = message;
	const { commandHandler } = instance;
	const {
		prefixHandler,
		commands,
		customCommands,
		runCommand,
	} = commandHandler as CommandHandler;

	const prefix = prefixHandler.get(guild?.id);

	if (!content.startsWith(prefix)) return;

	const args = content.split(/\s+/);
	const commandName = args
		.shift()
		?.substring(prefix.length)
		.toLowerCase();

	const command = commands.get(commandName) as Command;
	if (!command) {
		customCommands.run(commandName!, message);
		return;
	}

	const { reply, deferReply } = command.commandObject;

	if (deferReply) message.channel.sendTyping();

	const response = await runCommand(command, args, message, undefined!);
	if (!response) return;

	if (reply) message.reply(response).catch(() => {});
	else message.channel.send(response).catch(() => {});
};
