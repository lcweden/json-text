import Stitcher from "#src/modules/stitcher.ts";
import Lexer from "#src/modules/lexer.ts";
import Grammar from "#src/modules/grammar.ts";
import Tracker from "#src/modules/tracker.ts";
import { decode, validate } from "#src/utils/text.ts";
import { JSONPrimitiveValue, JSONStructuralCharacter } from "#src/common/types.ts";

/**
 * Configuration options for {@link JSONTextReader}.
 */
type JSONTextReaderOptions = {
  /**
   * Whether to allow duplicate property names within the same JSON object.
   *
   * @default false
   */
  allowDuplicateNames?: boolean;

  /**
   * Whether to allow invalid UTF-8 byte sequences in JSON strings.
   *
   * @default false
   */
  allowInvalidUTF8?: boolean;
  
  /**
   * The maximum allowed nesting depth of JSON arrays and objects.
   *
   * @default 10000
   */
  maxDepth?: number;
};

/**
 * Default configuration options for {@link JSONTextReader}.
 */
const DEFAULT_OPTIONS: Required<JSONTextReaderOptions> = {
  allowDuplicateNames: false,
  allowInvalidUTF8: false,
  maxDepth: 10000,
};

/**
 * Streaming-capable JSON text reader operating directly on UTF-8 byte arrays.
 *
 * @see {@link https://www.rfc-editor.org/info/rfc8259 | RFC 8259}
 */
class JSONTextReader {
  /**
   * Whether duplicate property names are allowed in objects.
   */
  #allowDuplicateNames: boolean;

  /**
   * Whether invalid UTF-8 sequences are allowed in strings.
   */
  #allowInvalidUTF8: boolean;

  /**
   * Starting position of an in-progress `readValue()` operation, or `-1` if inactive.
   */
  #anchor: number;

  /**
   * Total number of bytes discarded from previous chunks.
   */
  #consumed: number;

  /**
   * Whether the input stream has been marked as closed.
   */
  #closed: boolean;

  /**
   * The JSON grammar pushdown automaton.
   */
  #grammar: Grammar;

  /**
   * The JSON token lexer.
   */
  #lexer: Lexer;

  /**
   * The maximum allowed container nesting depth.
   */
  #maxDepth: number;

  /**
   * The current read cursor within the active byte view.
   */
  #position: number;

  /**
   * The byte chunk stitcher managing the active byte view.
   */
  #stitcher: Stitcher;

  /**
   * Target container depth for an in-progress `skipValue()` operation, or `-1` if inactive.
   */
  #target: number;

  /**
   * The object property name and duplicate-key scope tracker.
   */
  #tracker: Tracker;

  /**
   * Initialize a new instance of the JSONTextReader class.
   *
   * @param chunk Optional initial JSON byte chunk.
   * @param options Optional reader configuration options.
   * @throws {TypeError} If any option has an invalid type.
   * @throws {RangeError} If `maxDepth` is not a non-negative integer.
   */
  constructor( chunk?: Uint8Array, options?: JSONTextReaderOptions ) {
    this.#allowDuplicateNames = DEFAULT_OPTIONS.allowDuplicateNames;
    this.#allowInvalidUTF8 = DEFAULT_OPTIONS.allowInvalidUTF8;
    this.#anchor = -1;
    this.#consumed = 0;
    this.#closed = false;
    this.#grammar = new Grammar();
    this.#lexer = new Lexer();
    this.#maxDepth = DEFAULT_OPTIONS.maxDepth;
    this.#position = 0;
    this.#stitcher = new Stitcher();
    this.#target = -1;
    this.#tracker = new Tracker();

    if ( chunk ) {
      this.#stitcher.stitch( chunk, this.#position );
    }

    if ( options ) {
      if ( options.allowDuplicateNames !== undefined ) {
        if ( typeof options.allowDuplicateNames !== "boolean" ) {
          throw new TypeError( "allowDuplicateNames must be a boolean" );
        }

        this.#allowDuplicateNames = options.allowDuplicateNames;
      }

      if ( options.allowInvalidUTF8 !== undefined ) {
        if ( typeof options.allowInvalidUTF8 !== "boolean" ) {
          throw new TypeError( "allowInvalidUTF8 must be a boolean" );
        }

        this.#allowInvalidUTF8 = options.allowInvalidUTF8;
      }

      if ( options.maxDepth !== undefined ) {
        if ( typeof options.maxDepth !== "number" ) {
          throw new TypeError( "maxDepth must be a number" );
        }

        if ( !Number.isInteger( options.maxDepth ) || options.maxDepth < 0 ) {
          throw new RangeError( "Invalid maxDepth: must be a non-negative integer" );
        }

        this.#maxDepth = options.maxDepth;
      }
    }
  }

  /**
   * Get the current nesting depth of arrays and objects.
   */
  get depth(): number {
    return this.#grammar.depth;
  }

  /**
   * Get whether the top-level JSON value has been completely parsed.
   */
  get done(): boolean {
    return this.#grammar.done;
  }

  /**
   * Get the absolute byte offset from the start of the stream.
   */
  get offset(): number {
    return this.#consumed + this.#position;
  }

  /**
   * Mark the input stream as closed, indicating no further byte chunks will be pushed.
   */
  close(): void {
    this.#closed = true;
  }

  /**
   * Peek at the next JSON token kind without consuming it.
   *
   * Primitive value kinds:
   * - `"string"`: Literal string
   * - `"number"`: Numeric value
   * - `"true"`: Literal `true`
   * - `"false"`: Literal `false`
   * - `"null"`: Literal `null`
   *
   * Structural character kinds:
   * - `"begin-array"`: Opening bracket (`[`)
   * - `"end-array"`: Closing bracket (`]`)
   * - `"begin-object"`: Opening brace (`{`)
   * - `"end-object"`: Closing brace (`}`)
   * - `"name-separator"`: Colon (`:`)
   * - `"value-separator"`: Comma (`,`)
   *
   * @returns The next token kind, or `undefined` if more input is needed or parsing is complete.
   * @throws {SyntaxError} If the input ends unexpectedly, contains trailing data, or starts with an invalid byte.
   */
  peekKind(): JSONPrimitiveValue | JSONStructuralCharacter | undefined {
    const view = this.#stitcher.bytes;
    const position = Lexer.skipWhitespace( view, this.#position );

    this.#position = position;

    if ( position >= view.length ) {
      if ( this.#closed && !this.#grammar.done ) {
        throw new SyntaxError( "Unexpected end of data" );
      }

      return undefined;
    }

    if ( this.#grammar.done ) {
      throw new SyntaxError( "Unexpected non-whitespace character after JSON data" );
    }

    const kind = Lexer.getTokenKind( view[position] );

    if ( kind === undefined ) {
      throw new SyntaxError( "Unexpected character" );
    }

    return kind;
  }

  /**
   * Append a new chunk of UTF-8 JSON bytes to the reader.
   *
   * @param chunk The incoming byte chunk to append.
   * @throws {Error} If the reader has already been closed.
   */
  push( chunk: Uint8Array ): void {
    if ( this.#closed ) {
      throw new Error( "Cannot push to a closed reader" );
    }

    const cutoff = this.#anchor >= 0 ? this.#anchor : this.#position;

    this.#stitcher.stitch( chunk, cutoff );

    this.#consumed += cutoff;
    this.#position -= cutoff;

    if ( this.#anchor >= 0 ) {
      this.#anchor = 0;
    }
  }

  /**
   * Reset the reader state to its initial configuration for reuse.
   */
  reset(): void {
    this.#anchor = -1;
    this.#consumed = 0;
    this.#closed = false;
    this.#grammar.reset();
    this.#lexer.reset();
    this.#position = 0;
    this.#stitcher.reset();
    this.#target = -1;
    this.#tracker.reset();
  }

  /**
   * Consume and return the raw UTF-8 bytes of the next JSON token.
   *
   * Name separators (`:`) and value separators (`,`) are first-class tokens
   * and must be consumed via {@link readToken} before calling {@link readValue}
   * or {@link skipValue}.
   *
   * @returns A `Uint8Array` view of the token, or `undefined` if more input is needed or parsing is complete.
   * @throws {SyntaxError} If invalid JSON syntax, duplicate keys, or unexpected EOF is encountered.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   * @throws {TypeError} If invalid UTF-8 is encountered when `allowInvalidUTF8` is `false`.
   */
  readToken(): Uint8Array | undefined {
    const view = this.#stitcher.bytes;

    this.#position = Lexer.skipWhitespace( view, this.#position );

    if ( this.#position >= view.length ) {
      if ( this.#closed && !this.#grammar.done ) {
        throw new SyntaxError( "Unexpected end of data" );
      }

      return undefined;
    }

    const byte = view[this.#position];

    switch ( byte ) {
      case 0x5B /* [ */: {
        this.#grammar.stepBeginArray();

        if ( this.#grammar.depth > this.#maxDepth ) {
          throw new RangeError( "Maximum nesting depth exceeded" );
        }

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x5D /* ] */: {
        this.#grammar.stepEndArray();

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x7B /* { */: {
        this.#grammar.stepBeginObject();

        if ( this.#grammar.depth > this.#maxDepth ) {
          throw new RangeError( "Maximum nesting depth exceeded" );
        }

        this.#tracker.push();

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x7D /* } */: {
        this.#grammar.stepEndObject();
        this.#tracker.pop();

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x3A /* : */: {
        this.#grammar.stepNameSeparator();

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x2C /* , */: {
        this.#grammar.stepValueSeparator();

        const begin = this.#position;
        const end = ++this.#position;

        return view.subarray( begin, end );
      }
      case 0x22 /* " */: {
        const consumed = this.#lexer.consumeString( view, this.#position );

        if ( consumed === 0 ) {
          if ( this.#closed ) {
            throw new SyntaxError( "Unterminated string literal" );
          }

          return undefined;
        }

        if ( consumed < 0 ) {
          throw new SyntaxError( "Bad character in string literal" );
        }

        const bytes = view.subarray( this.#position, this.#position + consumed );
        if ( this.#grammar.type === "object" && this.#grammar.step === 1 ) {
          const decoded = decode( bytes, !this.#allowInvalidUTF8 );
          const name = JSON.parse( decoded );
          const unique = this.#tracker.add( name, !this.#allowDuplicateNames );

          if ( !unique ) {
            throw new SyntaxError( `Duplicate object name ${name}` );
          }

          this.#grammar.stepName();
        } else {
          if ( !this.#allowInvalidUTF8 ) {
            validate( bytes );
          }

          this.#grammar.stepValue();
        }

        this.#position += consumed;

        return bytes;
      }
      case 0x2D /* - */:
      case 0x30 /* 0 */:
      case 0x31 /* 1 */:
      case 0x32 /* 2 */:
      case 0x33 /* 3 */:
      case 0x34 /* 4 */:
      case 0x35 /* 5 */:
      case 0x36 /* 6 */:
      case 0x37 /* 7 */:
      case 0x38 /* 8 */:
      case 0x39 /* 9 */: {
        const consumed = this.#lexer.consumeNumber( view, this.#position );

        if ( consumed === 0 ) {
          if ( this.#closed ) {
            throw new SyntaxError( "Unexpected end of data" );
          }

          return undefined;
        }

        if ( consumed < 0 ) {
          throw new SyntaxError( "Unexpected non-digit" );
        }

        if ( !this.#closed && this.#position + consumed === view.length ) {
          return undefined;
        }

        this.#grammar.stepValue();

        const bytes = view.subarray( this.#position, this.#position + consumed );

        this.#position += consumed;

        return bytes;
      }
      case 0x74 /* t */: {
        const consumed = this.#lexer.consumeTrue( view, this.#position );

        if ( consumed === 0 ) {
          if ( this.#closed ) {
            throw new SyntaxError( "Unexpected keyword" );
          }

          return undefined;
        }

        if ( consumed < 0 ) {
          throw new SyntaxError( "Unexpected keyword" );
        }

        this.#grammar.stepValue();

        const bytes = view.subarray( this.#position, this.#position + consumed );

        this.#position += consumed;

        return bytes;
      }
      case 0x66 /* f */: {
        const consumed = this.#lexer.consumeFalse( view, this.#position );

        if ( consumed === 0 ) {
          if ( this.#closed ) {
            throw new SyntaxError( "Unexpected keyword" );
          }

          return undefined;
        }

        if ( consumed < 0 ) {
          throw new SyntaxError( "Unexpected keyword" );
        }

        this.#grammar.stepValue();

        const bytes = view.subarray( this.#position, this.#position + consumed );

        this.#position += consumed;

        return bytes;
      }
      case 0x6E /* n */: {
        const consumed = this.#lexer.consumeNull( view, this.#position );

        if ( consumed === 0 ) {
          if ( this.#closed ) {
            throw new SyntaxError( "Unexpected keyword" );
          }

          return undefined;
        }

        if ( consumed < 0 ) {
          throw new SyntaxError( "Unexpected keyword" );
        }

        this.#grammar.stepValue();

        const bytes = view.subarray( this.#position, this.#position + consumed );

        this.#position += consumed;

        return bytes;
      }
      default: {
        throw new SyntaxError( "Unexpected character" );
      }
    }
  }

  /**
   * Consume and return the raw UTF-8 bytes of the next complete JSON value
   *
   * @returns A `Uint8Array` view of the complete value, or `undefined` if more input is needed.
   * @throws {SyntaxError} If a value is not expected at the current position or contains invalid JSON.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   * @throws {TypeError} If invalid UTF-8 is encountered when `allowInvalidUTF8` is `false`.
   */
  readValue(): Uint8Array | undefined {
    if ( this.#anchor < 0 ) {
      if ( this.peekKind() === undefined ) {
        return undefined;
      }

      this.#anchor = this.#position;
    }

    if ( !this.skipValue() ) {
      return undefined;
    }

    const begin = this.#anchor;

    this.#anchor = -1;

    return this.#stitcher.bytes.subarray( begin, this.#position );
  }

  /**
   * Consume and skip the next complete JSON value without returning its bytes.
   *
   * @returns `true` if the complete value was skipped, or `false` if more input is needed.
   * @throws {SyntaxError} If a value is not expected at the current position or contains invalid JSON.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   * @throws {TypeError} If invalid UTF-8 is encountered when `allowInvalidUTF8` is `false`.
   */
  skipValue(): boolean {
    if ( this.#target < 0 ) {
      const kind = this.peekKind();

      if ( kind === undefined ) {
        return false;
      }

      if (
        this.#grammar.type === "object" &&
        this.#grammar.step === 1 &&
        kind === "string"
      ) {
        this.#grammar.stepValue();
      }

      if (
        kind === "end-array" ||
        kind === "end-object" ||
        kind === "name-separator" ||
        kind === "value-separator"
      ) {
        this.#grammar.stepValue();

        throw new SyntaxError( "Unexpected character" );
      }

      const depth = this.#grammar.depth;

      if ( !this.readToken() ) {
        return false;
      }

      if ( this.#grammar.depth === depth ) {
        return true;
      }

      this.#target = depth;
    }

    while ( this.#grammar.depth > this.#target ) {
      if ( !this.readToken() ) {
        return false;
      }
    }

    this.#target = -1;

    return true;
  }

  /**
   * Iterate over all remaining tokens currently available in the reader.
   */
  *[Symbol.iterator](): Iterator<Uint8Array> {
    let token: Uint8Array | undefined;

    while ( ( token = this.readToken() ) ) {
      yield token;
    }
  }
}

export default JSONTextReader;
export type { JSONTextReaderOptions };
