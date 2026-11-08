import { JSONReferenceValue } from "#src/common/types.ts";

/**
 * JSON grammar pushdown automaton.
 *
 * @see {@link https://www.rfc-editor.org/info/rfc8259 | RFC 8259}
 */
class Grammar {
  /**
   * The current state counter, 0: top-level, positive: array, negative: object.
   */
  #current: number;

  /**
   * Whether the JSON parsing has ended.
   */
  #ended: boolean;

  /**
   * The stack of previous state counters.
   */
  #stack: number[];

  /**
   * Initialize a new instance of the Grammar class.
   */
  constructor() {
    this.#current = 0;
    this.#ended = false;
    this.#stack = [];
  }

  /**
   * Get the current nesting depth of arrays and objects.
   */
  get depth(): number {
    return this.#stack.length;
  }

  /**
   * Get whether the JSON parsing has ended.
   */
  get ended(): boolean {
    return this.#ended;
  }

  /**
   * Get the current index within the current array, or `-1` if not in an array.
   */
  get index(): number {
    return this.#current > 0 ? this.#current - 1 >> 1 : -1;
  }

  /**
   * Get the current container micro-step, or `undefined` at top-level.
   *
   * Array context:
   * - `1`: Expecting array element (or `]` if empty)
   * - `2`: Expecting `,` or `]`
   *
   * Object context:
   * - `1`: Expecting property name (or `}` if empty)
   * - `2`: Expecting `:` after property name
   * - `3`: Expecting property value
   * - `4`: Expecting `,` or `}`
   */
  get step(): 1 | 2 | 3 | 4 | undefined {
    if ( this.#current > 0 ) {
      return ( ( this.#current - 1 & 1 ) + 1 ) as 1 | 2;
    }

    if ( this.#current < 0 ) {
      return ( ( ~this.#current & 3 ) + 1 ) as 1 | 2 | 3 | 4;
    }

    return undefined;
  }

  /**
   * Get the type of the current contained `"array"` or `"object"`, or `undefined` at top-level.
   */
  get type(): JSONReferenceValue | undefined {
    if ( this.#current > 0 ) {
      return "array";
    }

    if ( this.#current < 0 ) {
      return "object";
    }

    return undefined;
  }

  /**
   * Reset the grammar state to its initial top-level configuration.
   */
  reset(): void {
    this.#current = 0;
    this.#stack.length = 0;
    this.#ended = false;
  }

  /**
   * Advance the grammar state for an opening array bracket (`[`).
   *
   * @throws {SyntaxError} If an array cannot begin in the current grammar state.
   */
  stepBeginArray(): void {
    if ( this.#current === 0 && this.#ended ) {
      throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
    }

    if ( this.#current > 0 ) {
      if ( ( this.#current - 1 & 1 ) !== 0 ) {
        throw new SyntaxError( "Expected ',' or ']' after array element" );
      }
    } else if ( this.#current < 0 ) {
      if ( ~this.#current === 0 ) {
        throw new SyntaxError( "Expected property name or '}'" );
      }

      if ( ( ~this.#current & 3 ) === 0 ) {
        throw new SyntaxError( "Expected double-quoted property name" );
      }

      if ( ( ~this.#current & 3 ) === 1 ) {
        throw new SyntaxError( "Expected ':' after property name in object" );
      }

      if ( ( ~this.#current & 3 ) === 3 ) {
        throw new SyntaxError( "Expected ',' or '}' after property value in object" );
      }
    }

    this.#stack.push( this.#current );
    this.#current = 1;
  }

  /**
   * Advance the grammar state for an opening object brace (`{`).
   *
   * @throws {SyntaxError} If an object cannot begin in the current grammar state.
   */
  stepBeginObject(): void {
    if ( this.#current === 0 && this.#ended ) {
      throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
    }

    if ( this.#current > 0 ) {
      if ( ( this.#current - 1 & 1 ) !== 0 ) {
        throw new SyntaxError( "Expected ',' or ']' after array element" );
      }
    } else if ( this.#current < 0 ) {
      if ( ~this.#current === 0 ) {
        throw new SyntaxError( "Expected property name or '}'" );
      }

      if ( ( ~this.#current & 3 ) === 0 ) {
        throw new SyntaxError( "Expected double-quoted property name" );
      }

      if ( ( ~this.#current & 3 ) === 1 ) {
        throw new SyntaxError( "Expected ':' after property name in object" );
      }

      if ( ( ~this.#current & 3 ) === 3 ) {
        throw new SyntaxError( "Expected ',' or '}' after property value in object" );
      }
    }

    this.#stack.push( this.#current );
    this.#current = -1;
  }

  /**
   * Advance the grammar state for a closing array bracket (`]`).
   *
   * @throws {SyntaxError} If the current container is not an array or a value is expected after a comma.
   */
  stepEndArray(): void {
    if ( !( this.#current > 0 ) ) {
      throw new SyntaxError( "Unexpected character" );
    }

    if ( this.#current - 1 > 0 && ( this.#current - 1 & 1 ) === 0 ) {
      throw new SyntaxError( "Unexpected character" );
    }

    this.#current = this.#stack.pop()!;

    if ( this.#current === 0 ) {
      this.#ended = true;
    } else if ( this.#current > 0 ) {
      this.#current++;
    } else if ( this.#current < 0 ) {
      this.#current--;
    }
  }

  /**
   * Advance the grammar state for a closing object brace (`}`).
   *
   * @throws {SyntaxError} If the current container is not an object or an object member is incomplete.
   */
  stepEndObject(): void {
    if ( !( this.#current < 0 ) ) {
      throw new SyntaxError( "Unexpected character" );
    }

    if ( ~this.#current === 0 || ( ~this.#current & 3 ) === 3 ) {
      this.#current = this.#stack.pop()!;

      if ( this.#current === 0 ) {
        this.#ended = true;
      } else if ( this.#current > 0 ) {
        this.#current++;
      } else if ( this.#current < 0 ) {
        this.#current--;
      }

      return;
    }

    if ( ( ~this.#current & 3 ) === 0 ) {
      throw new SyntaxError( "Expected double-quoted property name" );
    }

    if ( ( ~this.#current & 3 ) === 1 ) {
      throw new SyntaxError( "Expected ':' after property name in object" );
    }

    throw new SyntaxError( "Unexpected character" );
  }

  /**
   * Advance the grammar state for an object property name.
   *
   * @throws {SyntaxError} If a property name is not expected in the current grammar state.
   */
  stepName(): void {
    if ( !( this.#current < 0 ) ) {
      throw new SyntaxError( "Unexpected character" );
    }

    if ( ( ~this.#current & 3 ) === 1 ) {
      throw new SyntaxError( "Expected ':' after property name in object" );
    }

    if ( ( ~this.#current & 3 ) === 3 ) {
      throw new SyntaxError( "Expected ',' or '}' after property value in object" );
    }

    if ( ( ~this.#current & 3 ) !== 0 ) {
      throw new SyntaxError( "Unexpected character" );
    }

    this.#current--;
  }

  /**
   * Advance the grammar state for a name separator (`:`).
   *
   * @throws {SyntaxError} If a name separator is not expected in the current grammar state.
   */
  stepNameSeparator(): void {
    if ( this.#current === 0 && this.#ended ) {
      throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
    }

    if ( this.#current > 0 ) {
      if ( ( this.#current - 1 & 1 ) !== 0 ) {
        throw new SyntaxError( "Expected ',' or ']' after array element" );
      }

      throw new SyntaxError( "Unexpected character" );
    }

    if ( !( this.#current < 0 ) ) {
      throw new SyntaxError( "Unexpected character" );
    }

    if ( ~this.#current === 0 ) {
      throw new SyntaxError( "Expected property name or '}'" );
    }

    if ( ( ~this.#current & 3 ) === 0 ) {
      throw new SyntaxError( "Expected double-quoted property name" );
    }

    if ( ( ~this.#current & 3 ) === 3 ) {
      throw new SyntaxError( "Expected ',' or '}' after property value in object" );
    }

    if ( ( ~this.#current & 3 ) !== 1 ) {
      throw new SyntaxError( "Unexpected character" );
    }

    this.#current--;
  }

  /**
   * Advance the grammar state for a primitive value (`string`, `number`, `true`, `false`, or `null`).
   *
   * @throws {SyntaxError} If a value is not expected in the current grammar state.
   */
  stepValue(): void {
    if ( this.#current === 0 ) {
      if ( this.#ended ) {
        throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
      }

      this.#ended = true;

      return;
    }

    if ( this.#current > 0 ) {
      if ( ( this.#current - 1 & 1 ) !== 0 ) {
        throw new SyntaxError( "Expected ',' or ']' after array element" );
      }

      this.#current++;
    } else if ( this.#current < 0 ) {
      if ( ~this.#current === 0 ) {
        throw new SyntaxError( "Expected property name or '}'" );
      }

      if ( ( ~this.#current & 3 ) === 0 ) {
        throw new SyntaxError( "Expected double-quoted property name" );
      }

      if ( ( ~this.#current & 3 ) === 1 ) {
        throw new SyntaxError( "Expected ':' after property name in object" );
      }

      if ( ( ~this.#current & 3 ) === 3 ) {
        throw new SyntaxError( "Expected ',' or '}' after property value in object" );
      }

      this.#current--;
    }
  }

  /**
   * Advance the grammar state for a value separator (`,`).
   *
   * @throws {SyntaxError} If a value separator is not expected in the current grammar state.
   */
  stepValueSeparator(): void {
    if ( this.#current === 0 ) {
      if ( this.#ended ) {
        throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
      }

      throw new SyntaxError( "Unexpected character" );
    }

    if ( this.#current > 0 ) {
      if ( this.#current - 1 === 0 || ( this.#current - 1 & 1 ) === 0 ) {
        throw new SyntaxError( "Unexpected character" );
      }

      this.#current++;
    } else if ( this.#current < 0 ) {
      if ( ~this.#current === 0 ) {
        throw new SyntaxError( "Expected property name or '}'" );
      }

      if ( ( ~this.#current & 3 ) === 0 ) {
        throw new SyntaxError( "Expected double-quoted property name" );
      }

      if ( ( ~this.#current & 3 ) === 1 ) {
        throw new SyntaxError( "Expected ':' after property name in object" );
      }

      if ( ( ~this.#current & 3 ) !== 3 ) {
        throw new SyntaxError( "Unexpected character" );
      }

      this.#current--;
    }
  }
}

export default Grammar;
