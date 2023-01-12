import { Interaction } from "discord.js";

export const event = (interaction: Interaction) => {
	if (interaction.isRepliable()) interaction.reply("testing");
};
