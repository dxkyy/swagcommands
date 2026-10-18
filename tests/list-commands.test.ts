import { ApplicationCommandType } from "discord.js";
import { describe, expect, it } from "vitest";

import SWAG from "../src/SWAG";
import CommandType from "../src/util/CommandType";

describe("listCommands", () => {
  it("returns an empty list when no command directories are configured", () => {
    const instance = Object.create(SWAG.prototype) as SWAG;
    expect(instance.listCommands()).toEqual([]);
  });

  it("lists loaded command kinds once with copied, sorted metadata", () => {
    const instance = Object.create(SWAG.prototype) as SWAG;
    const normalAliases = ["p"];
    const leafAliases = ["b"];
    const normal = {
      commandName: "ping",
      commandObject: {
        type: CommandType.BOTH,
        description: "Check responsiveness",
        aliases: normalAliases,
        callback: () => "pong",
      },
    };
    const root = {
      commandName: "admin",
      commandObject: {
        type: CommandType.SLASH,
        description: "Administration",
        aliases: ["mod"],
      },
      options: [
        { commandName: "status", optionObject: { description: "Show status" } },
        { commandName: "ban", optionObject: { description: "Ban a user", aliases: leafAliases } },
      ],
    };
    const userMenu = {
      commandName: "Inspect",
      commandObject: { type: ApplicationCommandType.User },
    };
    const messageMenu = {
      commandName: "Inspect",
      commandObject: { type: ApplicationCommandType.Message },
    };

    Object.assign(instance, {
      _commandHandler: { commands: new Map([["ping", normal], ["p", normal]]) },
      _subcommandHandler: { commands: new Map([["admin", root]]) },
      _contextMenuCommandHandler: {
        commands: new Map([["user:Inspect", userMenu], ["message:Inspect", messageMenu]]),
      },
    });

    expect(instance.listCommands()).toEqual([
      {
        kind: "subcommand",
        name: "admin",
        description: "Administration",
        type: CommandType.SLASH,
        aliases: ["mod"],
        subcommands: [
          { name: "ban", description: "Ban a user", aliases: ["b"] },
          { name: "status", description: "Show status", aliases: [] },
        ],
      },
      { kind: "contextMenu", name: "Inspect", type: ApplicationCommandType.User },
      { kind: "contextMenu", name: "Inspect", type: ApplicationCommandType.Message },
      {
        kind: "command",
        name: "ping",
        description: "Check responsiveness",
        type: CommandType.BOTH,
        aliases: ["p"],
      },
    ]);

    const listed = instance.listCommands();
    const listedNormal = listed.find((command) => command.kind === "command");
    const listedRoot = listed.find((command) => command.kind === "subcommand");
    listedNormal?.aliases.push("changed");
    listedRoot?.subcommands[0].aliases.push("changed");
    expect(normalAliases).toEqual(["p"]);
    expect(leafAliases).toEqual(["b"]);
    const fresh = instance.listCommands();
    expect(fresh.find((entry) => entry.kind === "command")).toMatchObject({ aliases: ["p"] });
    expect(fresh.find((entry) => entry.kind === "subcommand"))
      .toMatchObject({ subcommands: [{ aliases: ["b"] }, { aliases: [] }] });
  });
});
