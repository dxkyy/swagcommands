import { ApplicationCommandType } from "discord.js";
import { describe, expect, it } from "vitest";

import type {
  MessageContextMenuCommandObject,
  UserContextMenuCommandObject,
} from "../typings";

const userCommand: UserContextMenuCommandObject = {
  callback: (usage) => {
    usage.targetUser;
    usage.targetMember;
    // @ts-expect-error User context-menu callbacks do not receive a target message.
    usage.targetMessage;
  },
  type: ApplicationCommandType.User,
};

const messageCommand: MessageContextMenuCommandObject = {
  callback: (usage) => {
    usage.targetMessage;
    // @ts-expect-error Message context-menu callbacks do not receive a target user.
    usage.targetUser;
  },
  type: ApplicationCommandType.Message,
};

describe("context-menu command declaration types", () => {
  it("discriminates user and message callback usage", () => {
    expect(userCommand.type).toBe(ApplicationCommandType.User);
    expect(messageCommand.type).toBe(ApplicationCommandType.Message);
  });
});
