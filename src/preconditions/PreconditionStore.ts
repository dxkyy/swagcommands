import { Precondition } from "./Precondition";

export interface PreconditionLookup {
  get(name: string): Precondition | undefined;
}

export class PreconditionStore
  implements PreconditionLookup, Iterable<[string, Precondition]>
{
  private readonly preconditions = new Map<string, Precondition>();

  public get size(): number {
    return this.preconditions.size;
  }

  public register(precondition: Precondition): this {
    if (this.preconditions.has(precondition.name)) {
      throw new Error(
        `A precondition named "${precondition.name}" is already registered.`,
      );
    }

    this.preconditions.set(precondition.name, precondition);
    return this;
  }

  public get(name: string): Precondition | undefined {
    return this.preconditions.get(name);
  }

  public has(name: string): boolean {
    return this.preconditions.has(name);
  }

  public delete(name: string): boolean {
    return this.preconditions.delete(name);
  }

  public clear(): void {
    this.preconditions.clear();
  }

  public values(): IterableIterator<Precondition> {
    return this.preconditions.values();
  }

  public [Symbol.iterator](): IterableIterator<[string, Precondition]> {
    return this.preconditions[Symbol.iterator]();
  }
}
