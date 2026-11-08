/**
 * Byte chunk stitcher with zero-copy pass-through, in-place compaction,
 * and exponential capacity growth.
 */
class Stitcher {
  /**
   * The active byte view representing unconsumed and newly stitched bytes.
   */
  #bytes: Uint8Array;

  /**
   * Whether the underlying `ArrayBuffer` is owned by this instance and safe to mutate in-place.
   */
  #owned: boolean;

  /**
   * Initialize a new instance of the Stitcher class.
   */
  constructor() {
    this.#bytes = new Uint8Array( 0 );
    this.#owned = false;
  }

  /**
   * Get the current active byte view.
   */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  /**
   * Reset the stitcher state, releasing the current byte view.
   */
  reset(): void {
    this.#bytes = new Uint8Array( 0 );
    this.#owned = false;
  }

  /**
   * Discard `consumed` bytes from the current view and stitch `chunk` onto the remaining tail.
   *
   * @param chunk The new incoming byte chunk to append.
   * @param consumed The number of bytes consumed from the current view.
   * @throws {RangeError} If `consumed` is negative or exceeds the current view length.
   */
  stitch( chunk: Uint8Array, consumed: number ): void {
    if ( consumed < 0 || consumed > this.#bytes.length ) {
      throw new RangeError( "Invalid consumed count: out of buffer bounds" );
    }

    const retained = this.#bytes.length - consumed;
    const required = retained + chunk.length;

    if ( retained === 0 ) {
      this.#bytes = chunk;
      this.#owned = false;

      return;
    }

    if ( this.#owned && required <= this.#bytes.buffer.byteLength ) {
      const current = new Uint8Array( this.#bytes.buffer );

      if ( consumed > 0 ) {
        current.copyWithin( 0, consumed, consumed + retained );
      }

      this.#bytes = current.subarray( 0, required );
      this.#bytes.set( chunk, retained );

      return;
    }

    const capacity = this.#owned ? this.#bytes.buffer.byteLength : 0;
    const allocated = Math.max( required, capacity * 2 );
    const next = new Uint8Array( allocated );

    next.set( this.#bytes.subarray( consumed ), 0 );
    next.set( chunk, retained );

    this.#bytes = next.subarray( 0, required );
    this.#owned = true;
  }
}

export default Stitcher;
