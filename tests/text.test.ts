import { expect } from "@std/expect";
import { decode, encode, validate } from "@src/utils/text.ts";

Deno.test("[unit] text", async ( test ) => {
  await test.step("[scenario] encode", async ( test ) => {
    await test.step("[case] should encode a string into Uint8Array", () => {
      expect( encode( "Hi!" ) ).toEqual( new Uint8Array( [ 72, 105, 33 ] ) );
    });

    await test.step("[case] should encode empty string", () => {
      expect( encode( "" ) ).toEqual( new Uint8Array( [] ) );
    });

    await test.step("[case] should encode multi-byte characters", () => {
      expect( encode( "中" ) ).toEqual( new Uint8Array( [ 228, 184, 173 ] ) );
      expect( encode( "🔥" ) ).toEqual( new Uint8Array( [ 240, 159, 148, 165 ] ) );
    });
  });

  await test.step("[scenario] decode", async ( test ) => {
    await test.step("[case] should decode valid Uint8Array to string", () => {
      expect( decode( new Uint8Array( [ 104, 101, 108, 108, 111 ] ) ) ).toEqual( "hello" );
    });

    await test.step("[case] should handle empty Uint8Array", () => {
      expect( decode( new Uint8Array( [] ) ) ).toEqual( "" );
    });

    await test.step("[case] should replace invalid characters when fatal is false", () => {
      expect( decode( new Uint8Array( [ 0xFF ] ) ) ).toEqual( "\uFFFD" );
      expect( decode( new Uint8Array( [ 0xFF ] ), false ) ).toEqual( "\uFFFD" );
    });

    await test.step("[case] should throw error on invalid characters when fatal is true", () => {
      expect( () => decode( new Uint8Array( [ 0xFF ] ), true ) ).toThrow( TypeError );
    });
  });

  await test.step("[scenario] validate", async ( test ) => {
    await test.step("[case] should not throw when input is valid UTF-8", () => {
      expect( () => validate( new Uint8Array( [ 240, 159, 148, 165 ] ) ) ).not.toThrow();
    });

    await test.step("[case] should throw TypeError when input is invalid UTF-8", () => {
      expect( () => validate( new Uint8Array( [ 0xC0, 0xAF ] ) ) ).toThrow( TypeError );
    });
  });
});
