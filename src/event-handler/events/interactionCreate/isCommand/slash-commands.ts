import { ChatInputCommandInteraction } from "discord.js";

import SWAG from "../../../../../typings";

export default async (
  interaction: ChatInputCommandInteraction,
  instance: SWAG,
) => {
  if (!interaction.isCommand()) return;
  const { commandHandler } = instance;
  if (!commandHandler) {
    return;
  }

  const { commands } = commandHandler;

  const args = interaction.options.data.map(({ value }) => {
    return String(value);
  });

  const command = commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  const { deferReply } = command.commandObject;
  const responseContext = {
    commandName: command.commandName,
    invocationKind: "interaction" as const,
  };

  if (
    deferReply &&
    !(await instance.responseHandler.defer(
      interaction,
      deferReply,
      responseContext,
    ))
  ) {
    return;
  }

  const response = await commandHandler.runCommand(
    command,
    args,
    null,
    interaction,
  );
  if (response === undefined) {
    return;
  }

  await instance.responseHandler.respondToInteraction(
    interaction,
    response,
    responseContext,
  );
};
