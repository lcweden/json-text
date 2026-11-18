/**
 * Escape `<`, `>`, and `&` in UTF-8 JSON string bytes as `\u003c`, `\u003e`, and `\u0026`.
 *
 * @param input The UTF-8 byte array of a JSON string.
 * @returns A new escaped byte array, or `input` unchanged if no target characters are present.
 */
function escapeHTML( input: Uint8Array ): Uint8Array {
  let count = 0;

  for ( let index = 0; index < input.length; index++ ) {
    const byte = input[index];

    if (
      byte === 0x3C /* < */ ||
      byte === 0x3E /* > */ ||
      byte === 0x26 /* & */
    ) {
      count++;
    }
  }

  if ( count === 0 ) {
    return input;
  }

  const output = new Uint8Array( input.length + count * 5 );
  let cursor = 0;
  let start = 0;

  for ( let index = 0; index < input.length; index++ ) {
    const byte = input[index];

    if (
      byte !== 0x3C /* < */ &&
      byte !== 0x3E /* > */ &&
      byte !== 0x26 /* & */
    ) {
      continue;
    }

    if ( index > start ) {
      output.set( input.subarray( start, index ), cursor );
      cursor += index - start;
    }

    const sequence = byte === 0x3C /* < */
      ? new Uint8Array( [ 0x5C, 0x75, 0x30, 0x30, 0x33, 0x63 ] ) /* \u003c */
      : byte === 0x3E /* > */
      ? new Uint8Array( [ 0x5C, 0x75, 0x30, 0x30, 0x33, 0x65 ] ) /* \u003e */
      : new Uint8Array( [ 0x5C, 0x75, 0x30, 0x30, 0x32, 0x36 ] ); /* \u0026 */

    output.set( sequence, cursor );

    cursor += 6;
    start = index + 1;
  }

  if ( start < input.length ) {
    output.set( input.subarray( start ), cursor );
  }

  return output;
}

/**
 * Escape U+2028 and U+2029 in UTF-8 JSON string bytes as `\u2028` and `\u2029`.
 *
 * @param input The UTF-8 byte array of a JSON string.
 * @returns A new escaped byte array, or `input` unchanged if no target characters are present.
 */
function escapeJS( input: Uint8Array ): Uint8Array {
  let count = 0;

  for ( let index = 0; index <= input.length - 3; index++ ) {
    if (
      input[index] === 0xE2 &&
      input[index + 1] === 0x80 &&
      ( input[index + 2] === 0xA8 ||
        input[index + 2] === 0xA9 )
    ) {
      count++;
      index += 2;
    }
  }

  if ( count === 0 ) {
    return input;
  }

  const output = new Uint8Array( input.length + count * 3 );
  let cursor = 0;
  let start = 0;

  for ( let index = 0; index <= input.length - 3; index++ ) {
    if (
      input[index] !== 0xE2 ||
      input[index + 1] !== 0x80 ||
      ( input[index + 2] !== 0xA8 &&
        input[index + 2] !== 0xA9 )
    ) {
      continue;
    }

    if ( index > start ) {
      output.set( input.subarray( start, index ), cursor );

      cursor += index - start;
    }

    const sequence = input[index + 2] === 0xA8
      ? new Uint8Array( [ 0x5C, 0x75, 0x32, 0x30, 0x32, 0x38 ] ) /* \u2028 */
      : new Uint8Array( [ 0x5C, 0x75, 0x32, 0x30, 0x32, 0x39 ] ); /* \u2029 */

    output.set( sequence, cursor );

    cursor += 6;
    start = index + 3;
    index += 2;
  }

  if ( start < input.length ) {
    output.set( input.subarray( start ), cursor );
  }

  return output;
}

export { escapeHTML, escapeJS };
