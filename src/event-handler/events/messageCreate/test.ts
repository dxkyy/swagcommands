import { Message } from "discord.js";

export const event = (message: Message) => {
	console.log(message.content);
};
