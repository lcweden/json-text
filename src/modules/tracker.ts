/**
 * Object property name and duplicate-key scope tracker across nesting levels.
 *
 * @see {@link https://www.rfc-editor.org/info/rfc8259 | RFC 8259}
 */
class Tracker {
  /**
   * The current object nesting depth.
   */
  #depth: number;

  /**
   * The active property name at each object nesting depth.
   */
  #names: string[];

  /**
   * The set of seen property names at each object nesting depth.
   */
  #scopes: Set<string>[];

  /**
   * Initialize a new instance of the Tracker class.
   */
  constructor() {
    this.#depth = 0;
    this.#names = [];
    this.#scopes = [];
  }

  /**
   * Get the current object nesting depth.
   */
  get depth(): number {
    return this.#depth;
  }

  /**
   * Get the most recently recorded property name in the current object scope, or `""` if none.
   */
  get lastName(): string {
    return this.#depth > 0 ? this.#names[this.#depth - 1] : "";
  }

  /**
   * Enter a new object scope, allocating or reusing a property name set for the new depth.
   */
  push(): void {
    this.#names[this.#depth] = "";

    if ( this.#depth >= this.#scopes.length ) {
      this.#scopes.push( new Set() );
    }

    this.#depth++;
  }

  /**
   * Exit the current object scope and clear its recorded property names.
   */
  pop(): void {
    if ( this.#depth === 0 ) {
      return;
    }

    this.#depth--;
    this.#scopes[this.#depth].clear();
  }

  /**
   * Record a property name in the current object scope and optionally check for duplicates.
   *
   * @param name The decoded object property name.
   * @param unique Whether to enforce uniqueness within the current object scope.
   * @returns `true` if the property name is accepted, or `false` if `unique` is enabled and the name already exists.
   */
  setName( name: string, unique: boolean ): boolean {
    const index = this.#depth - 1;

    this.#names[index] = name;

    if ( !unique ) {
      return true;
    }

    const scope = this.#scopes[index];

    if ( scope.has( name ) ) {
      return false;
    }

    scope.add( name );

    return true;
  }

  /**
   * Get the active property name at the specified object depth.
   *
   * @param depth The 0-based object depth index.
   * @returns The property name at `depth`, or `""` if not set.
   */
  getName( depth: number ): string {
    return this.#names[depth] ?? "";
  }

  /**
   * Reset the tracker state, clearing all active object scopes.
   */
  reset(): void {
    for ( let index = 0; index < this.#depth; index++ ) {
      this.#scopes[index].clear();
    }

    this.#depth = 0;
  }
}

export default Tracker;
