import { describe, expect, it, vi } from "vitest";

import { EventExecutionError } from "../../src/errors/EventExecutionError";
import EventHandler from "../../src/event-handler/EventHandler";

type RegisteredListener = (...args: unknown[]) => Promise<void>;

const createHandler = (
  callbacks: unknown[][],
  instance: Record<string, unknown> = {},
) => {
  let listener: RegisteredListener | undefined;
  const client = {
    on: vi.fn((_eventName: string, registered: RegisteredListener) => {
      listener = registered;
    }),
  };
  const handler = Object.create(EventHandler.prototype) as {
    _client: typeof client;
    _eventCallbacks: Map<string, unknown[][]>;
    _instance: Record<string, unknown>;
    registerEvents(): void;
  };

  handler._client = client;
  handler._eventCallbacks = new Map([["customEvent", callbacks]]);
  handler._instance = instance;
  handler.registerEvents();

  if (!listener) {
    throw new Error("The event listener was not registered");
  }

  return {
    client,
    listener,
  };
};

describe("event execution", () => {
  it("awaits one event callback before running the next callback", async () => {
    let finishFirstCallback!: () => void;
    const firstCallback = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFirstCallback = resolve;
        }),
    );
    const secondCallback = vi.fn().mockResolvedValue(undefined);
    const { listener } = createHandler([[firstCallback], [secondCallback]]);

    const dispatch = listener("event argument");
    await Promise.resolve();

    expect(firstCallback).toHaveBeenCalledWith("event argument", {});
    expect(secondCallback).not.toHaveBeenCalled();

    finishFirstCallback();
    await dispatch;

    expect(secondCallback).toHaveBeenCalledWith("event argument", {});
  });

  it("reports callback failures and stops the remaining callbacks", async () => {
    const failure = new Error("event callback failed");
    const firstCallback = vi.fn().mockRejectedValue(failure);
    const secondCallback = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn().mockResolvedValue(undefined);
    const instance = { reportError };
    const { listener } = createHandler(
      [[firstCallback], [secondCallback]],
      instance,
    );

    await listener("event argument");

    expect(secondCallback).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(EventExecutionError);
    expect(reportError.mock.calls[0][0]).toMatchObject({
      cause: failure,
      code: "SWAG_EVENT_EXECUTION_FAILED",
      context: {
        eventName: "customEvent",
      },
      phase: "event",
    });
  });
});
