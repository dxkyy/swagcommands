import { describe, expect, it, vi } from "vitest";

import EventHandler from "../../src/event-handler/EventHandler";

type RegisteredListener = (...args: unknown[]) => Promise<void>;

const createHandler = (callbacks: unknown[][]) => {
  let listener: RegisteredListener | undefined;
  const client = {
    on: vi.fn((_eventName: string, registered: RegisteredListener) => {
      listener = registered;
    }),
  };
  const handler = Object.create(EventHandler.prototype) as {
    _client: typeof client;
    _eventCallbacks: Map<string, unknown[][]>;
    _instance: Record<string, never>;
    registerEvents(): void;
  };

  handler._client = client;
  handler._eventCallbacks = new Map([["customEvent", callbacks]]);
  handler._instance = {};
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
});
