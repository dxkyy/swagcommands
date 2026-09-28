import { describe, expect, it } from "vitest";

import SWAGCommands, {
  CommandType,
  MemoryPrefixStore,
  Precondition,
  SWAGCommands as NamedSWAGCommands,
} from "../src/index";

describe("public entry point", () => {
  it("exposes the class through default and named exports", () => {
    expect(NamedSWAGCommands).toBe(SWAGCommands);
    expect(CommandType.SLASH).toBe("SLASH");
    expect(new MemoryPrefixStore()).toBeInstanceOf(MemoryPrefixStore);
    expect(typeof Precondition).toBe("function");
  });
});
