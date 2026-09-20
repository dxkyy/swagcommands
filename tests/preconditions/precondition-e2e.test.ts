import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => {
  const files = new Map<
    string,
    Array<{ fileContents: unknown; filePath: string }>
  >();

  return {
    files,
    getAllFiles: vi.fn((directory: string) => files.get(directory) ?? []),
  };
});

vi.mock("../../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import SWAG from "../../src/SWAG";
import { Precondition } from "../../src/preconditions/Precondition";
import CommandType from "../../src/util/CommandType";

const createMessage = () => ({
  author: { bot: false, id: "user-id" },
  channel: {
    id: "channel-id",
    send: vi.fn().mockResolvedValue(undefined),
    sendTyping: vi.fn().mockResolvedValue(undefined),
  },
  guild: { id: "guild-id" },
  member: {},
  reply: vi.fn().mockResolvedValue(undefined),
});

describe("precondition command integration", () => {
  beforeEach(() => {
    loading.files.clear();
    loading.getAllFiles.mockClear();
  });

  it("loads, resolves, and executes preconditions while rejecting a concurrent cooldown claim", async () => {
    const customRuns = vi.fn();
    class Enabled extends Precondition {
      public messageRun() {
        customRuns();
        return this.ok();
      }
    }

    const callback = vi.fn().mockResolvedValue("executed");
    loading.files.set("/preconditions", [
      {
        fileContents: Enabled,
        filePath: "/preconditions/Enabled.ts",
      },
    ]);
    loading.files.set("/commands", [
      {
        fileContents: {
          callback,
          preconditions: [
            "Enabled",
            { name: "Cooldown", context: { duration: 10_000 } },
          ],
          reply: true,
          type: CommandType.LEGACY,
        },
        filePath: "/commands/limited.ts",
      },
    ]);

    const failureHook = vi.fn(({ failure }) => failure.identifier);
    const client = {
      application: {
        fetch: vi.fn().mockResolvedValue(undefined),
        owner: { id: "owner-id" },
      },
      on: vi.fn(),
    };
    const instance = await SWAG.create({
      client: client as never,
      commandsDir: "/commands",
      onPreconditionFailure: failureHook,
      preconditionsDir: "/preconditions",
    });
    const command = instance.commandHandler!.commands.get("limited")!;
    const firstMessage = createMessage();
    const secondMessage = createMessage();

    await Promise.all([
      instance.commandHandler!.runCommand(
        command,
        [],
        firstMessage as never,
        null,
      ),
      instance.commandHandler!.runCommand(
        command,
        [],
        secondMessage as never,
        null,
      ),
    ]);

    expect(customRuns).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledOnce();
    expect(failureHook).toHaveBeenCalledOnce();
    expect(failureHook).toHaveBeenCalledWith(
      expect.objectContaining({
        command,
        failure: expect.objectContaining({
          identifier: "COOLDOWN_ACTIVE",
          preconditionName: "Cooldown",
        }),
      }),
    );
    expect([
      ...firstMessage.reply.mock.calls,
      ...secondMessage.reply.mock.calls,
    ].flat()).toEqual(expect.arrayContaining(["executed", "COOLDOWN_ACTIVE"]));
  });
});
