import path from "path";

import type SWAG from "../../typings";
import getAllFiles from "../util/get-all-files";
import { Precondition } from "./Precondition";
import { PreconditionStore } from "./PreconditionStore";

type PreconditionConstructor = new (
  instance: SWAG,
  name: string,
) => Precondition;

function isPreconditionConstructor(
  value: unknown,
): value is PreconditionConstructor {
  return (
    typeof value === "function" &&
    (value === Precondition || value.prototype instanceof Precondition)
  );
}

export class PreconditionHandler {
  private loading: Promise<void> | undefined;

  public constructor(
    private readonly instance: SWAG,
    private readonly preconditionsDir: string,
    private readonly store: PreconditionStore,
  ) {}

  public load(): Promise<void> {
    this.loading ??= this.readFiles();
    return this.loading;
  }

  private async readFiles(): Promise<void> {
    for (const file of getAllFiles(this.preconditionsDir)) {
      const PreconditionClass = file.fileContents;
      if (!isPreconditionConstructor(PreconditionClass)) {
        throw new TypeError(
          `Precondition file "${file.filePath}" must default-export a class extending Precondition.`,
        );
      }

      const name = path.parse(file.filePath).name;
      this.store.register(new PreconditionClass(this.instance, name));
    }
  }
}
