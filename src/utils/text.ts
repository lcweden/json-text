/**
 * TextEncoder for UTF-8 encoding.
 */
const encoder = new TextEncoder();

/**
 * TextDecoder for UTF-8 decoding.
 */
const decoder = new TextDecoder( "utf-8" );

/**
 * TextDecoder for UTF-8 decoding with fatal error on decoding failure.
 */
const validator = new TextDecoder( "utf-8", { fatal: true } );

/**
 * Encode a UTF-8 string into a byte array.
 *
 * @param input The string to encode.
 * @returns The UTF-8 encoded byte array.
 */
function encode( input: string ): Uint8Array {
  return encoder.encode( input );
}

/**
 * Decode a UTF-8 byte array into a string.
 *
 * @param input The UTF-8 byte array to decode.
 * @param fatal Whether to throw a `TypeError` on invalid UTF-8 sequences.
 * @returns The decoded string.
 * @throws {TypeError} If `fatal` is `true` and the input contains invalid UTF-8 bytes.
 */
function decode( input: Uint8Array, fatal?: boolean ): string {
  return fatal ? validator.decode( input ) : decoder.decode( input );
}

/**
 * Validate that a byte array contains well-formed UTF-8 sequences.
 *
 * @param input The byte array to validate.
 * @throws {TypeError} If the input contains invalid UTF-8 bytes.
 */
function validate( input: Uint8Array ): void {
  return void validator.decode( input );
}

export { decode, encode, validate };
