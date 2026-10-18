import { Message } from "discord.js";

import type SWAG from "../../../../SWAG";

export default async (message: Message, instance: SWAG) => {
  await instance.messageCommandRouter.execute(message);
};
