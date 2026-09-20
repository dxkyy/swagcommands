import { describe, expect, it, vi } from "vitest";

import { Precondition } from "../../src/preconditions/Precondition";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";

const createStore = () => new PreconditionStore();

const register = (
  store: PreconditionStore,
  name: string,
  success: boolean,
) => {
  const precondition = new Precondition({} as never, name);
  const run = vi.fn((_usage, _command, context) =>
    success
      ? precondition.ok()
      : precondition.error({
          context,
          identifier: `${name.toUpperCase()}_DENIED`,
          message: `${name} denied the command.`,
        }),
  );
  precondition.messageRun = run;
  precondition.chatInputRun = run;
  store.register(precondition);

  return { precondition, run };
};

describe("precondition containers", () => {
  it("runs flat entries as a short-circuiting AND expression", async () => {
    const store = createStore();
    const first = register(store, "First", true);
    const second = register(store, "Second", false);
    const third = register(store, "Third", true);
    const container = new PreconditionContainerArray(store, [
      "First",
      "Second",
      "Third",
    ]);

    const result = await container.messageRun({} as never, {} as never);

    expect(result).toMatchObject({
      failure: { preconditionName: "Second" },
      success: false,
    });
    expect(first.run).toHaveBeenCalledOnce();
    expect(second.run).toHaveBeenCalledOnce();
    expect(third.run).not.toHaveBeenCalled();
  });

  it("alternates nested groups between OR and AND", async () => {
    const store = createStore();
    const denied = register(store, "Denied", false);
    const firstAllowed = register(store, "FirstAllowed", true);
    const secondAllowed = register(store, "SecondAllowed", true);
    const neverReached = register(store, "NeverReached", true);
    const container = new PreconditionContainerArray(store, [
      [
        "Denied",
        ["FirstAllowed", "SecondAllowed"],
        "NeverReached",
      ],
    ]);

    const result = await container.chatInputRun({} as never, {} as never);

    expect(result).toEqual({ success: true });
    expect(denied.run).toHaveBeenCalledOnce();
    expect(firstAllowed.run).toHaveBeenCalledOnce();
    expect(secondAllowed.run).toHaveBeenCalledOnce();
    expect(neverReached.run).not.toHaveBeenCalled();
  });

  it("returns the last failure when every OR alternative fails", async () => {
    const store = createStore();
    register(store, "First", false);
    register(store, "Second", false);
    const container = new PreconditionContainerArray(store, [
      ["First", "Second"],
    ]);

    const result = await container.messageRun({} as never, {} as never);

    expect(result).toMatchObject({
      failure: {
        identifier: "SECOND_DENIED",
        preconditionName: "Second",
      },
      success: false,
    });
  });

  it("merges and freezes inherited and entry-specific context", async () => {
    const store = createStore();
    const contextual = register(store, "Contextual", false);
    const container = new PreconditionContainerArray(store, [
      {
        context: { level: 3, shared: "entry" },
        name: "Contextual",
      },
    ]);

    const result = await container.messageRun({} as never, {} as never, {
      global: true,
      shared: "outer",
    });

    expect(contextual.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { global: true, level: 3, shared: "entry" },
    );
    const receivedContext = contextual.run.mock.calls[0][2];
    expect(Object.isFrozen(receivedContext)).toBe(true);
    expect(result).toMatchObject({
      failure: {
        context: { global: true, level: 3, shared: "entry" },
      },
    });
  });

  it("returns structured failures for unavailable or unsupported flows", async () => {
    const store = createStore();
    const messageOnly = new Precondition({} as never, "MessageOnly");
    messageOnly.messageRun = () => messageOnly.ok();
    store.register(messageOnly);

    const unavailable = new PreconditionContainerArray(store, ["Missing"]);
    const unsupported = new PreconditionContainerArray(store, ["MessageOnly"]);

    await expect(
      unavailable.messageRun({} as never, {} as never),
    ).resolves.toMatchObject({
      failure: { identifier: "PRECONDITION_UNAVAILABLE" },
      success: false,
    });
    await expect(
      unsupported.chatInputRun({} as never, {} as never),
    ).resolves.toMatchObject({
      failure: { identifier: "PRECONDITION_MISSING_CHAT_INPUT_HANDLER" },
      success: false,
    });
  });

  it("allows an empty root container but rejects empty nested groups", async () => {
    const store = createStore();

    await expect(
      new PreconditionContainerArray(store).messageRun(
        {} as never,
        {} as never,
      ),
    ).resolves.toEqual({ success: true });
    expect(
      () => new PreconditionContainerArray(store, [[]]),
    ).toThrow("A nested precondition group cannot be empty.");
  });
});
