import { ContextMenuCommandInteraction } from "discord.js";

import type SWAG from "../../../../SWAG";

export default async (
  interaction: ContextMenuCommandInteraction,
  instance: SWAG,
) => {
  if (!interaction.isContextMenuCommand()) {
    return;
  }

  const { contextMenuCommandHandler } = instance;
  if (!contextMenuCommandHandler) {
    return;
  }

  const command = contextMenuCommandHandler.getCommand(
    interaction.commandName,
    interaction.commandType,
  );
  if (!command) {
    return;
  }

  await contextMenuCommandHandler.runCommand(command, interaction);
};
