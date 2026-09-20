import {
  ApplicationCommandOptionType,
  ChatInputApplicationCommandData,
} from "discord.js";
import { describe, expect, it, vi } from "vitest";

import Command from "../../src/command-handler/Command";
import { buildCommandManifests } from "../../src/deployment/CommandManifestBuilder";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import Subcommand from "../../src/subcommand-handler/Subcommand";
import SubcommandOption from "../../src/subcommand-handler/SubcommandOption";
import CommandType from "../../src/util/CommandType";
import SWAG, {
  CommandObject,
  SubcommandObject,
  SubcommandOptionObject,
} from "../../typings";

const instance = {} as SWAG;
const preconditions = () =>
  new PreconditionContainerArray(new PreconditionStore());

const createCommand = (
  name: string,
  definition: Partial<CommandObject> & Pick<CommandObject, "type">,
) =>
  new Command(
    instance,
    name,
    {
      callback: vi.fn(),
      description: `${name} description`,
      ...definition,
    },
    preconditions(),
  );

const createSubcommand = (
  name: string,
  definition: SubcommandObject,
  options: Array<{
    fileName: string;
    definition: SubcommandOptionObject;
  }>,
) =>
  new Subcommand(
    instance,
    name,
    definition,
    options.map(
      ({ fileName, definition: option }) =>
        new SubcommandOption(
          instance,
          fileName,
          option,
          preconditions(),
        ),
    ),
    preconditions(),
  );

const findCommand = (
  commands: readonly ChatInputApplicationCommandData[],
  name: string,
) => commands.find((command) => command.name === name);

describe("application command manifest builder", () => {
  it("includes slash-capable commands once and sorts them by name", () => {
    const alpha = createCommand("alpha", { type: CommandType.SLASH });
    const beta = createCommand("beta", { type: CommandType.BOTH });
    const legacy = createCommand("legacy", { type: CommandType.LEGACY });

    const manifests = buildCommandManifests({
      commands: [beta, alpha, alpha, legacy],
    });

    expect(manifests.global.map((command) => command.name)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(manifests.test).toEqual([]);
  });

  it("preserves explicit options and generates expected argument options", () => {
    const explicit = createCommand("explicit", {
      type: CommandType.SLASH,
      options: [
        {
          name: "count",
          description: "Number of items",
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
        },
      ],
    });
    const generated = createCommand("generated", {
      type: CommandType.SLASH,
      expectedArgs: "<First Value> [Second]",
      minArgs: 1,
    });

    const { global } = buildCommandManifests({
      commands: [explicit, generated],
    });

    expect(findCommand(global, "explicit")?.options).toEqual([
      {
        name: "count",
        description: "Number of items",
        type: ApplicationCommandOptionType.Integer,
        minValue: 1,
      },
    ]);
    expect(findCommand(global, "generated")?.options).toEqual([
      {
        name: "first-value",
        description: "First Value",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "second",
        description: "Second",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ]);
  });

  it("builds subcommands and subcommand groups", () => {
    const command = createSubcommand(
      "admin",
      { description: "Administration" },
      [
        {
          fileName: "status",
          definition: {
            callback: vi.fn(),
            name: "status",
            description: "Show status",
            options: [
              {
                name: "verbose",
                description: "Include details",
                type: ApplicationCommandOptionType.Boolean,
              },
            ],
          },
        },
        {
          fileName: "moderation",
          definition: {
            callback: vi.fn(),
            name: "moderation",
            description: "Moderation commands",
            options: [
              {
                name: "ban",
                description: "Ban a member",
                type: ApplicationCommandOptionType.Subcommand,
              },
            ],
          },
        },
      ],
    );

    const { global } = buildCommandManifests({ subcommands: [command] });

    expect(global).toEqual([
      {
        name: "admin",
        description: "Administration",
        options: [
          {
            name: "status",
            description: "Show status",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: "verbose",
                description: "Include details",
                type: ApplicationCommandOptionType.Boolean,
              },
            ],
          },
          {
            name: "moderation",
            description: "Moderation commands",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: "ban",
                description: "Ban a member",
                type: ApplicationCommandOptionType.Subcommand,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("partitions test commands and rejects duplicate roots per scope", () => {
    const global = createCommand("ping", { type: CommandType.SLASH });
    const test = createCommand("preview", {
      type: CommandType.SLASH,
      testOnly: true,
    });

    expect(
      buildCommandManifests({ commands: [global, test] }),
    ).toMatchObject({
      global: [{ name: "ping" }],
      test: [{ name: "preview" }],
    });

    const duplicate = createSubcommand(
      "ping",
      { description: "Duplicate" },
      [],
    );
    expect(() =>
      buildCommandManifests({
        commands: [global],
        subcommands: [duplicate],
      }),
    ).toThrowError(/defined more than once/);
  });

  it("rejects malformed nested subcommand options", () => {
    const malformed = createSubcommand(
      "admin",
      { description: "Administration" },
      [
        {
          fileName: "mixed",
          definition: {
            callback: vi.fn(),
            name: "mixed",
            description: "Mixed options",
            options: [
              {
                name: "ban",
                description: "Ban a member",
                type: ApplicationCommandOptionType.Subcommand,
              },
              {
                name: "reason",
                description: "Reason",
                type: ApplicationCommandOptionType.String,
              },
            ],
          },
        },
      ],
    );

    expect(() =>
      buildCommandManifests({ subcommands: [malformed] }),
    ).toThrowError(/mixes subcommands with argument options/);
  });
});
