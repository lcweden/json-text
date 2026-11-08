import Stitcher from "@src/modules/stitcher.ts";
import { expect } from "@std/expect";

Deno.test("[unit] stitcher", async ( test ) => {
  await test.step("[scenario] initial state and lifecycle", async ( test ) => {
    const encoder = new TextEncoder();

    await test.step("[case] should initialize with empty state", () => {
      const stitcher = new Stitcher();

      expect( stitcher.bytes ).toEqual( new Uint8Array( 0 ) );
      expect( stitcher.bytes.length ).toBe( 0 );
    });

    await test.step("[case] should reset state and release current byte view", () => {
      const stitcher = new Stitcher();

      stitcher.stitch( encoder.encode( "hello" ), 0 );
      stitcher.stitch( encoder.encode( "world" ), 3 );

      expect( stitcher.bytes.length ).toBe( 7 );

      stitcher.reset();

      expect( stitcher.bytes ).toEqual( new Uint8Array( 0 ) );
      expect( stitcher.bytes.length ).toBe( 0 );
    });

    await test.step("[case] should throw RangeError when consumed count is out of bounds", () => {
      const stitcher = new Stitcher();

      stitcher.stitch( encoder.encode( "hello" ), 0 );

      expect( () => stitcher.stitch( encoder.encode( "!" ), -1 ) )
        .toThrow( RangeError );

      expect( () => stitcher.stitch( encoder.encode( "!" ), 6 ) )
        .toThrow( "Invalid consumed count: out of buffer bounds" );
    });
  });

  await test.step("[scenario] stitch and memory management", async ( test ) => {
    const encoder = new TextEncoder();

    await test.step("[case] should adopt incoming chunk directly when retained bytes are zero", () => {
      const stitcher = new Stitcher();
      const first = encoder.encode( "abcd" );
      const second = encoder.encode( "efghij" );

      stitcher.stitch( first, 0 );

      expect( stitcher.bytes.length ).toBe( 4 );
      expect( stitcher.bytes ).toEqual( first );
      expect( stitcher.bytes.buffer ).toBe( first.buffer );

      stitcher.stitch( second, 4 );

      expect( stitcher.bytes.length ).toBe( 6 );
      expect( stitcher.bytes ).toEqual( second );
      expect( stitcher.bytes.buffer ).toBe( second.buffer );
    });

    await test.step("[case] should allocate owned buffer when unowned bytes are partially retained", () => {
      const stitcher = new Stitcher();
      const first = encoder.encode( "abcd" );
      const second = encoder.encode( "efgh" );

      stitcher.stitch( first, 0 );
      stitcher.stitch( second, 2 );

      expect( stitcher.bytes.length ).toBe( 6 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "cdefgh" ) );
      expect( stitcher.bytes.buffer ).not.toBe( first.buffer );
      expect( stitcher.bytes.buffer ).not.toBe( second.buffer );
    });

    await test.step("[case] should compact in-place when owned capacity is sufficient", () => {
      const stitcher = new Stitcher();

      stitcher.stitch( encoder.encode( "abcd" ), 0 );
      stitcher.stitch( encoder.encode( "efgh" ), 2 );

      const underlying = stitcher.bytes.buffer;

      expect( underlying.byteLength ).toBe( 6 );

      stitcher.stitch( encoder.encode( "ijk" ), 4 );

      expect( stitcher.bytes.length ).toBe( 5 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "ghijk" ) );
      expect( stitcher.bytes.buffer ).toBe( underlying );

      stitcher.stitch( encoder.encode( "!" ), 0 );

      expect( stitcher.bytes.length ).toBe( 6 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "ghijk!" ) );
      expect( stitcher.bytes.buffer ).toBe( underlying );
    });

    await test.step("[case] should grow owned buffer by doubling capacity when required exceeds capacity", () => {
      const stitcher = new Stitcher();

      stitcher.stitch( encoder.encode( "abcd" ), 0 );
      stitcher.stitch( encoder.encode( "efgh" ), 2 );

      const initialBuffer = stitcher.bytes.buffer;

      stitcher.stitch( encoder.encode( "ijk" ), 1 );

      const grownBuffer = stitcher.bytes.buffer;

      expect( stitcher.bytes.length ).toBe( 8 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "defghijk" ) );
      expect( grownBuffer ).not.toBe( initialBuffer );
      expect( grownBuffer.byteLength ).toBe( 12 );

      stitcher.stitch( encoder.encode( "lmno" ), 2 );

      expect( stitcher.bytes.length ).toBe( 10 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "fghijklmno" ) );
      expect( stitcher.bytes.buffer ).toBe( grownBuffer );
    });

    await test.step("[case] should grow owned buffer to required size when required exceeds doubled capacity", () => {
      const stitcher = new Stitcher();

      stitcher.stitch( encoder.encode( "ab" ), 0 );
      stitcher.stitch( encoder.encode( "cde" ), 1 );

      expect( stitcher.bytes.buffer.byteLength ).toBe( 4 );

      stitcher.stitch( encoder.encode( "0123456789" ), 1 );

      expect( stitcher.bytes.length ).toBe( 13 );
      expect( stitcher.bytes ).toEqual( encoder.encode( "cde0123456789" ) );
      expect( stitcher.bytes.buffer.byteLength ).toBe( 13 );
    });
  });
});
