import { ChatInputCommandInteraction } from "discord.js";

import SWAG from "../../../../../typings";

export default async (
  interaction: ChatInputCommandInteraction,
  instance: SWAG,
) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const { subcommandHandler } = instance;
  if (!subcommandHandler) {
    return;
  }

  const resolved = subcommandHandler.resolveChatInputCommand(interaction);
  if (!resolved) {
    return;
  }

  await subcommandHandler.runCommand(
    resolved.command,
    resolved.args,
    null,
    interaction,
    {
      subcommandGroup: resolved.subcommandGroup,
      subcommandName: resolved.subcommandName,
    },
  );
};
