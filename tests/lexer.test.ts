import Lexer from "@src/modules/lexer.ts";
import { expect } from "@std/expect";

Deno.test("[unit] Lexer", async ( test ) => {
  await test.step("[scenario] get token type", async ( test ) => {
    await test.step("[case] should identify structural characters", () => {
      expect( Lexer.getType( 0x7B /* { */ ) ).toBe( "begin-object" );
      expect( Lexer.getType( 0x7D /* } */ ) ).toBe( "end-object" );
      expect( Lexer.getType( 0x5B /* [ */ ) ).toBe( "begin-array" );
      expect( Lexer.getType( 0x5D /* ] */ ) ).toBe( "end-array" );
      expect( Lexer.getType( 0x3A /* : */ ) ).toBe( "name-separator" );
      expect( Lexer.getType( 0x2C /* , */ ) ).toBe( "value-separator" );
    });

    await test.step("[case] should identify primitive value leading bytes", () => {
      expect( Lexer.getType( 0x22 /* " */ ) ).toBe( "string" );
      expect( Lexer.getType( 0x74 /* t */ ) ).toBe( "true" );
      expect( Lexer.getType( 0x66 /* f */ ) ).toBe( "false" );
      expect( Lexer.getType( 0x6E /* n */ ) ).toBe( "null" );
      expect( Lexer.getType( 0x2D /* - */ ) ).toBe( "number" );

      for ( let byte = 0x30 /* 0 */; byte <= 0x39 /* 9 */; byte++ ) {
        expect( Lexer.getType( byte ) ).toBe( "number" );
      }
    });

    await test.step("[case] should return undefined for unrecognized bytes", () => {
      expect( Lexer.getType( 0x20 /* [space] */ ) ).toBeUndefined();
      expect( Lexer.getType( 0x2B /* + */ ) ).toBeUndefined();
      expect( Lexer.getType( 0x61 /* a */ ) ).toBeUndefined();
      expect( Lexer.getType( 0xFF ) ).toBeUndefined();
    });
  });

  await test.step("[scenario] skip whitespace", async ( test ) => {
    const encoder = new TextEncoder();

    await test.step("[case] should skip all valid JSON whitespace characters", () => {
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x20, 0x41 ] ), 0 ) ).toBe( 1 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x09, 0x41 ] ), 0 ) ).toBe( 1 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x0A, 0x41 ] ), 0 ) ).toBe( 1 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x0D, 0x41 ] ), 0 ) ).toBe( 1 );
    });

    await test.step("[case] should return initial offset if starting byte is not whitespace", () => {
      expect( Lexer.skipWhitespace( encoder.encode( "A" ), 0 ) ).toBe( 0 );
    });

    await test.step("[case] should skip whitespace starting from a non-zero offset", () => {
      expect( Lexer.skipWhitespace( encoder.encode( "X   Y" ), 1 ) ).toBe( 4 );
    });

    await test.step("[case] should advance to bytes.length when buffer contains only whitespace", () => {
      expect( Lexer.skipWhitespace( encoder.encode( "  \t\r\n  " ), 0 ) ).toBe( 7 );
    });

    await test.step("[case] should strictly stop at ASCII control characters that are NOT JSON whitespace", () => {
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x00, 0x20 ] ), 0 ) ).toBe( 0 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x0B, 0x20 ] ), 0 ) ).toBe( 0 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x0C, 0x20 ] ), 0 ) ).toBe( 0 );
      expect( Lexer.skipWhitespace( new Uint8Array( [ 0x1F, 0x20 ] ), 0 ) ).toBe( 0 );
    });

    await test.step("[case] should handle empty buffer and out-of-bounds offset safely", () => {
      expect( Lexer.skipWhitespace( new TextEncoder().encode( "abc" ), 3 ) ).toBe( 3 );
      expect( Lexer.skipWhitespace( new TextEncoder().encode( "abc" ), 10 ) ).toBe( 10 );
      expect( Lexer.skipWhitespace( new Uint8Array( 0 ), 0 ) ).toBe( 0 );
    });
  });

  await test.step("[scenario] consume literals", async ( test ) => {
    const lexer = new Lexer();
    const encoder = new TextEncoder();

    await test.step("[case] should consume null, true, and false and return length", () => {
      expect( lexer.consumeNull( encoder.encode( "null" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeTrue( encoder.encode( "true" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeFalse( encoder.encode( "false" ), 0 ) ).toBe( 5 );
    });

    await test.step("[case] should correctly match at a non-zero offset", () => {
      const input = encoder.encode( "xxnull_true_false" );

      expect( lexer.consumeNull( input, 2 ) ).toBe( 4 );
      expect( lexer.consumeTrue( input, 7 ) ).toBe( 4 );
      expect( lexer.consumeFalse( input, 12 ) ).toBe( 5 );
    });

    await test.step("[case] should return 0 when prefix is valid but truncated at buffer end", () => {
      expect( lexer.consumeNull( encoder.encode( "n" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNull( encoder.encode( "nu" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNull( encoder.encode( "nul" ), 0 ) ).toBe( 0 );

      expect( lexer.consumeTrue( encoder.encode( "t" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeTrue( encoder.encode( "tr" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeTrue( encoder.encode( "tru" ), 0 ) ).toBe( 0 );

      expect( lexer.consumeFalse( encoder.encode( "f" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeFalse( encoder.encode( "fa" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeFalse( encoder.encode( "fal" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeFalse( encoder.encode( "fals" ), 0 ) ).toBe( 0 );
    });

    await test.step("[case] should return -1 immediately if any byte deviates", () => {
      expect( lexer.consumeNull( encoder.encode( "xull" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "nxll" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "nuxl" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "nulx" ), 0 ) ).toBe( -1 );

      expect( lexer.consumeTrue( encoder.encode( "xrue" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "txue" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "trxe" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "trux" ), 0 ) ).toBe( -1 );

      expect( lexer.consumeFalse( encoder.encode( "xalse" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "fxlse" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "faxse" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "falxe" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "falsx" ), 0 ) ).toBe( -1 );
    });

    await test.step("[case] should reject uppercase or titlecase literals per RFC 8259", () => {
      expect( lexer.consumeNull( encoder.encode( "Null" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "NULL" ), 0 ) ).toBe( -1 );

      expect( lexer.consumeTrue( encoder.encode( "True" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "TRUE" ), 0 ) ).toBe( -1 );

      expect( lexer.consumeFalse( encoder.encode( "False" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "FALSE" ), 0 ) ).toBe( -1 );
    });

    await test.step("[case] should only consume the exact length and ignore trailing bytes", () => {
      expect( lexer.consumeNull( encoder.encode( "null," ), 0 ) ).toBe( 4 );
      expect( lexer.consumeTrue( encoder.encode( "true," ), 0 ) ).toBe( 4 );
      expect( lexer.consumeFalse( encoder.encode( "false," ), 0 ) ).toBe( 5 );
    });

    await test.step("[case] should return -1 safely when offset is at or beyond buffer length", () => {
      expect( lexer.consumeNull( new Uint8Array( 0 ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "null" ), 4 ) ).toBe( -1 );
      expect( lexer.consumeNull( encoder.encode( "null" ), 10 ) ).toBe( -1 );

      expect( lexer.consumeTrue( new Uint8Array( 0 ), 0 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "true" ), 4 ) ).toBe( -1 );
      expect( lexer.consumeTrue( encoder.encode( "true" ), 10 ) ).toBe( -1 );

      expect( lexer.consumeFalse( new Uint8Array( 0 ), 0 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "false" ), 5 ) ).toBe( -1 );
      expect( lexer.consumeFalse( encoder.encode( "false" ), 10 ) ).toBe( -1 );
    });
  });

  await test.step("[scenario] consume number", async ( test ) => {
    const lexer = new Lexer();
    const encoder = new TextEncoder();

    await test.step("[case] should consume valid integers and negative integers", () => {
      expect( lexer.consumeNumber( encoder.encode( "0" ), 0 ) ).toBe( 1 );
      expect( lexer.consumeNumber( encoder.encode( "5" ), 0 ) ).toBe( 1 );
      expect( lexer.consumeNumber( encoder.encode( "42" ), 0 ) ).toBe( 2 );
      expect( lexer.consumeNumber( encoder.encode( "1234567890" ), 0 ) ).toBe( 10 );
      expect( lexer.consumeNumber( encoder.encode( "-0" ), 0 ) ).toBe( 2 );
      expect( lexer.consumeNumber( encoder.encode( "-100" ), 0 ) ).toBe( 4 );
    });

    await test.step("[case] should reject leading zeros per RFC 8259", () => {
      expect( lexer.consumeNumber( encoder.encode( "00" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "01" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "0123" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "-00" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "-01" ), 0 ) ).toBe( -1 );
    });

    await test.step("[case] should consume valid decimal fractions", () => {
      expect( lexer.consumeNumber( encoder.encode( "0.0" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "0.123" ), 0 ) ).toBe( 5 );
      expect( lexer.consumeNumber( encoder.encode( "-0.5" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeNumber( encoder.encode( "123.456" ), 0 ) ).toBe( 7 );
      expect( lexer.consumeNumber( encoder.encode( "-999.0001" ), 0 ) ).toBe( 9 );
    });

    await test.step("[case] should consume valid scientific exponent notations", () => {
      expect( lexer.consumeNumber( encoder.encode( "1e5" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "1E10" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeNumber( encoder.encode( "1e+5" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeNumber( encoder.encode( "1e-5" ), 0 ) ).toBe( 4 );
      expect( lexer.consumeNumber( encoder.encode( "0e1" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "-123.456e+78" ), 0 ) ).toBe( 12 );
      expect( lexer.consumeNumber( encoder.encode( "-0.12E-34" ), 0 ) ).toBe( 9 );
    });

    await test.step("[case] should consume numbers at a non-zero offset correctly", () => {
      expect( lexer.consumeNumber( encoder.encode( "xx123.45yy" ), 2 ) ).toBe( 6 );
    });

    await test.step("[case] should consume valid number prefix and stop before trailing characters", () => {
      expect( lexer.consumeNumber( encoder.encode( "123," ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123]" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123}" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123 " ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "0x12" ), 0 ) ).toBe( 1 );
      expect( lexer.consumeNumber( encoder.encode( "42px" ), 0 ) ).toBe( 2 );
      expect( lexer.consumeNumber( encoder.encode( "100ms" ), 0 ) ).toBe( 3 );
    });

    await test.step("[case] should reject invalid number syntax immediately", () => {
      expect( lexer.consumeNumber( encoder.encode( "+1" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( ".5" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "1.a" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "1.," ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "-a" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "1ea" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "1e+a" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "1e-a" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "NaN" ), 0 ) ).toBe( -1 );
      expect( lexer.consumeNumber( encoder.encode( "Infinity" ), 0 ) ).toBe( -1 );
    });

    await test.step("[case] should return 0 (NeedMore) when number syntax is truncated at buffer end", () => {
      expect( lexer.consumeNumber( encoder.encode( "-" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNumber( encoder.encode( "123." ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNumber( encoder.encode( "123e" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNumber( encoder.encode( "123E+" ), 0 ) ).toBe( 0 );
      expect( lexer.consumeNumber( encoder.encode( "123e-" ), 0 ) ).toBe( 0 );

      expect( lexer.consumeNumber( new Uint8Array( 0 ), 0 ) ).toBe( 0 );
    });

    await test.step("[case] should stop consuming exactly before delimiter characters", () => {
      expect( lexer.consumeNumber( encoder.encode( "123," ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123]" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123}" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123 " ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "123\n" ), 0 ) ).toBe( 3 );
      expect( lexer.consumeNumber( encoder.encode( "-42.5:" ), 0 ) ).toBe( 5 );
    });
  });

  await test.step("[scenario] consume string", async ( test ) => {
    const lexer = new Lexer();
    const encoder = new TextEncoder();

    await test.step("[case] should consume plain ASCII strings via fast path", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `""` ), 0 ) ).toBe( 2 );
      expect( lexer.consumeString( encoder.encode( `"hello"` ), 0 ) ).toBe( 7 );
      expect( lexer.consumeString( encoder.encode( `"user_id_12345"` ), 0 ) ).toBe( 15 );
      expect( lexer.consumeString( encoder.encode( `"123.456"` ), 0 ) ).toBe( 9 );
    });

    await test.step("[case] should consume multi-byte UTF-8 strings by falling back to resumable path", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"你好，世界"` ), 0 ) ).toBe( 17 );
      expect( lexer.consumeString( encoder.encode( `"hello 😊"` ), 0 ) ).toBe( 12 );
    });

    await test.step("[case] should consume valid standard 2-byte escape sequences", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"\\""` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\\\"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\/"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\b"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\f"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\n"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\r"` ), 0 ) ).toBe( 4 );
      expect( lexer.consumeString( encoder.encode( `"\\t"` ), 0 ) ).toBe( 4 );
    });

    await test.step("[case] should consume valid 6-byte \\uXXXX sequences with case-insensitive hex", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"\\u0041"` ), 0 ) ).toBe( 8 );
      expect( lexer.consumeString( encoder.encode( `"\\u0000"` ), 0 ) ).toBe( 8 );
      expect( lexer.consumeString( encoder.encode( `"\\u12af\\u34CD"` ), 0 ) ).toBe( 14 );
      expect( lexer.consumeString( encoder.encode( `"\\uFFFF"` ), 0 ) ).toBe( 8 );
    });

    await test.step("[case] should reject invalid string syntax immediately per RFC 8259", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `hello"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( new Uint8Array( [ 0x22, 0x00, 0x22 ] ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( new Uint8Array( [ 0x22, 0x0A, 0x22 ] ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( new Uint8Array( [ 0x22, 0x0D, 0x22 ] ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( new Uint8Array( [ 0x22, 0x09, 0x22 ] ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\a"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\'"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\v"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\0"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\u004G"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\u123z"` ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"\\u-123"` ), 0 ) ).toBe( -1 );
    });

    await test.step("[case] should handle stream truncation and atomic resumption across chunks", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"hello world` ), 0 ) ).toBe( 0 );
      expect( lexer.consumeString( encoder.encode( `"hello world"` ), 0 ) ).toBe( 13 );

      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"foo\\` ), 0 ) ).toBe( 0 );
      expect( lexer.consumeString( encoder.encode( `"foo\\n"` ), 0 ) ).toBe( 7 );

      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"bar\\u` ), 0 ) ).toBe( 0 );
      expect( lexer.consumeString( encoder.encode( `"bar\\u0041"` ), 0 ) ).toBe( 11 );

      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"baz\\u12` ), 0 ) ).toBe( 0 );
      expect( lexer.consumeString( encoder.encode( `"baz\\u1234"` ), 0 ) ).toBe( 11 );
    });

    await test.step("[case] should consume string precisely and stop before trailing characters", () => {
      lexer.reset();

      expect( lexer.consumeString( encoder.encode( `"title": "demo"` ), 0 ) ).toBe( 7 );
      expect( lexer.consumeString( encoder.encode( `"item",` ), 0 ) ).toBe( 6 );
      expect( lexer.consumeString( encoder.encode( `"last"]` ), 0 ) ).toBe( 6 );
      expect( lexer.consumeString( encoder.encode( `"obj"}` ), 0 ) ).toBe( 5 );
      expect( lexer.consumeString( encoder.encode( `  "_test"  ` ), 2 ) ).toBe( 7 );
    });

    await test.step("[case] should return -1 safely when offset is at or beyond buffer length", () => {
      lexer.reset();

      expect( lexer.consumeString( new Uint8Array( 0 ), 0 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"abc"` ), 5 ) ).toBe( -1 );
      expect( lexer.consumeString( encoder.encode( `"abc"` ), 10 ) ).toBe( -1 );
    });
  });
});
