import { Message } from "discord.js";

import SWAG from "../../../../../typings";

export default async (message: Message, instance: SWAG) => {
  await instance.messageCommandRouter.execute(message);
};
