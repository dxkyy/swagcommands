import { ChatInputCommandInteraction } from "discord.js";

import SWAG from "../../../../../typings";

export default async (
  interaction: ChatInputCommandInteraction,
  instance: SWAG,
) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const { commandHandler } = instance;
  if (!commandHandler) {
    return;
  }

  const command = commandHandler.commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  const args = interaction.options.data
    .filter(({ value }) => value !== undefined)
    .map(({ value }) => String(value));
  await commandHandler.runCommand(command, args, null, interaction);
};
