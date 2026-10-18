/**
 * JSON lexer for scanning whitespace and primitive tokens in UTF-8 byte arrays.
 */
class Lexer {
  /** Relative byte offset from the string start for resuming string scanning. */
  #checkpoint: number;

  /**
   * Initializes a new instance of the Lexer class.
   */
  constructor() {
    this.#checkpoint = 0;
  }

  /**
   * Skip valid whitespace characters in the input byte array.
   *
   * Whitespace characters:
   * - `%x20`: Space
   * - `%x09`: Horizontal tab
   * - `%x0A`: Line feed or New line
   * - `%x0D`: Carriage return
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns Returns the new offset after skipping whitespace.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-2 | RFC 8259}
   */
  skipWhitespace(bytes: Uint8Array, offset: number): number {
    while (offset < bytes.length) {
      const byte = bytes[offset];

      // Fast path:
      // if the byte is greater than space, it's not whitespace.
      if (byte > 0x20 /* [space] */) {
        break;
      }

      if (
        byte === 0x20 /* [space] */ ||
        byte === 0x09 /* [tab] */ ||
        byte === 0x0A /* [line feed] */ ||
        byte === 0x0D /* [carriage return] */
      ) {
        offset++;
      } else {
        break;
      }
    }

    return offset;
  }

  /**
   * Try to consume the `null` literal from the input byte array.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-3 | RFC 8259}
   */
  consumeNull(bytes: Uint8Array, offset: number): number {
    const remaining = bytes.length - offset;

    if (remaining <= 0) {
      return -1;
    }

    if (bytes[offset] !== 0x6E /* n */) {
      return -1;
    }

    if (remaining === 1) {
      return 0;
    }

    if (bytes[offset + 1] !== 0x75 /* u */) {
      return -1;
    }

    if (remaining === 2) {
      return 0;
    }

    if (bytes[offset + 2] !== 0x6C /* l */) {
      return -1;
    }

    if (remaining === 3) {
      return 0;
    }

    if (bytes[offset + 3] !== 0x6C /* l */) {
      return -1;
    }

    return 4;
  }

  /**
   * Try to consume the `true` literal from the input byte array.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-3 | RFC 8259}
   */
  consumeTrue(bytes: Uint8Array, offset: number): number {
    const remaining = bytes.length - offset;

    if (remaining <= 0) {
      return -1;
    }

    if (bytes[offset] !== 0x74 /* t */) {
      return -1;
    }

    if (remaining === 1) {
      return 0;
    }

    if (bytes[offset + 1] !== 0x72 /* r */) {
      return -1;
    }

    if (remaining === 2) {
      return 0;
    }

    if (bytes[offset + 2] !== 0x75 /* u */) {
      return -1;
    }

    if (remaining === 3) {
      return 0;
    }

    if (bytes[offset + 3] !== 0x65 /* e */) {
      return -1;
    }

    return 4;
  }

  /**
   * Try to consume the `false` literal from the input byte array.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-3 | RFC 8259}
   */
  consumeFalse(bytes: Uint8Array, offset: number): number {
    const remaining = bytes.length - offset;

    if (remaining <= 0) {
      return -1;
    }

    if (bytes[offset] !== 0x66 /* f */) {
      return -1;
    }

    if (remaining === 1) {
      return 0;
    }

    if (bytes[offset + 1] !== 0x61 /* a */) {
      return -1;
    }

    if (remaining === 2) {
      return 0;
    }

    if (bytes[offset + 2] !== 0x6C /* l */) {
      return -1;
    }

    if (remaining === 3) {
      return 0;
    }

    if (bytes[offset + 3] !== 0x73 /* s */) {
      return -1;
    }

    if (remaining === 4) {
      return 0;
    }

    if (bytes[offset + 4] !== 0x65 /* e */) {
      return -1;
    }

    return 5;
  }

  /**
   * Try to consume a numeric value from the input byte array.
   * Numeric values follow ABNF as defined in RFC 8259.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-6 | RFC 8259}
   */
  consumeNumber(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length) {
      return 0;
    }

    let index = offset;

    if (bytes[index] === 0x2D /* - */) {
      index++;

      if (index >= bytes.length) {
        return 0;
      }
    }

    if (bytes[index] === 0x30 /* 0 */) {
      index++;

      if (
        index < bytes.length &&
        bytes[index] >= 0x30 /* 0 */ &&
        bytes[index] <= 0x39 /* 9 */
      ) {
        return -1;
      }
    } else if (
      bytes[index] >= 0x31 /* 1 */ &&
      bytes[index] <= 0x39 /* 9 */
    ) {
      index++;

      while (
        index < bytes.length &&
        bytes[index] >= 0x30 /* 0 */ &&
        bytes[index] <= 0x39 /* 9 */
      ) {
        index++;
      }
    } else {
      return -1;
    }

    if (index >= bytes.length) {
      return index - offset;
    }

    if (
      bytes[index] !== 0x2E /* . */ &&
      bytes[index] !== 0x65 /* e */ &&
      bytes[index] !== 0x45 /* E */
    ) {
      return index - offset;
    }

    if (bytes[index] === 0x2E /* . */) {
      index++;

      if (index >= bytes.length) {
        return 0;
      }

      if (
        bytes[index] < 0x30 /* 0 */ ||
        bytes[index] > 0x39 /* 9 */
      ) {
        return -1;
      }

      while (
        index < bytes.length &&
        bytes[index] >= 0x30 /* 0 */ &&
        bytes[index] <= 0x39 /* 9 */
      ) {
        index++;
      }
    }

    if (
      index < bytes.length &&
      (
        bytes[index] === 0x65 /* e */ ||
        bytes[index] === 0x45 /* E */
      )
    ) {
      index++;

      if (index >= bytes.length) {
        return 0;
      }

      if (
        bytes[index] === 0x2B /* + */ ||
        bytes[index] === 0x2D /* - */
      ) {
        index++;

        if (index >= bytes.length) {
          return 0;
        }
      }

      if (
        bytes[index] < 0x30 /* 0 */ ||
        bytes[index] > 0x39 /* 9 */
      ) {
        return -1;
      }

      while (
        index < bytes.length &&
        bytes[index] >= 0x30 /* 0 */ &&
        bytes[index] <= 0x39 /* 9 */
      ) {
        index++;
      }
    }

    return index - offset;
  }

  /**
   * Try to consume a string value from the input byte array.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-7 | RFC 8259}
   */
  consumeString(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length || bytes[offset] !== 0x22 /* " */) {
      return (this.#checkpoint = 0, -1);
    }

    if (this.#checkpoint === 0) {
      const consumed = this.consumeStringFast(bytes, offset);

      if (consumed !== 0) {
        return consumed;
      }
    }

    const consumed = this.consumeStringResumable(bytes, offset);

    if (consumed !== 0) {
      this.#checkpoint = 0;
    }

    return consumed;
  }

  /**
   * Try to consume a string value with a fast path that does not handle escape sequences.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, or `0` if incomplete or invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-7 | RFC 8259}
   */
  consumeStringFast(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length || bytes[offset] !== 0x22 /* " */) {
      return 0;
    }

    for (let index = offset + 1; index < bytes.length; index++) {
      const byte = bytes[index];

      if (byte === 0x22 /* " */) {
        return index - offset + 1;
      }

      if (
        byte < 0x20 /* [space] */ ||
        byte >= 0x7F /* [delete] */ ||
        byte === 0x5C /* \ */
      ) {
        return 0;
      }
    }

    return 0;
  }

  /**
   * Try to consume a string value in a resumable manner, handling escape sequences.
   *
   * @param bytes The JSON input byte array.
   * @param offset The starting position in the byte array.
   * @returns The number of bytes consumed, `0` if the input is incomplete, or `-1` if invalid.
   * @see {@link https://www.rfc-editor.org/info/rfc8259/#section-7 | RFC 8259}
   */
  consumeStringResumable(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length || bytes[offset] !== 0x22 /* " */) {
      return -1;
    }

    const start = this.#checkpoint;
    let index = start > 0 ? offset + start : offset + 1;

    for (; index < bytes.length; index++) {
      const byte = bytes[index];

      if (byte < 0x20 /* [space] */) {
        return -1;
      }

      if (byte === 0x22 /* " */) {
        return index - offset + 1;
      }

      if (byte === 0x5C /* \ */) {
        if (index + 1 >= bytes.length) {
          return (this.#checkpoint = index - offset, 0);
        }

        const next = bytes[index + 1];

        if (next === 0x75 /* u */) {
          if (index + 5 >= bytes.length) {
            return (this.#checkpoint = index - offset, 0);
          }

          for (let count = 2; count <= 5; count++) {
            const hex = bytes[index + count];

            if (
              !(
                (hex >= 0x30 /* 0 */ && hex <= 0x39 /* 9 */) ||
                (hex >= 0x61 /* a */ && hex <= 0x66 /* f */) ||
                (hex >= 0x41 /* A */ && hex <= 0x46 /* F */)
              )
            ) {
              return -1;
            }
          }

          index += 5;

          continue;
        }

        if (
          next !== 0x22 /* " */ &&
          next !== 0x5C /* \ */ &&
          next !== 0x2F /* / */ &&
          next !== 0x62 /* b */ &&
          next !== 0x66 /* f */ &&
          next !== 0x6E /* n */ &&
          next !== 0x72 /* r */ &&
          next !== 0x74 /* t */
        ) {
          return -1;
        }

        index += 1;

        continue;
      }
    }

    return (this.#checkpoint = bytes.length - offset, 0);
  }

  /**
   * Reset the lexer state, clearing any stored checkpoint.
   */
  reset(): void {
    this.#checkpoint = 0;
  }
}

export default Lexer;
