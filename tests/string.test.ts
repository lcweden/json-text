import { escapeHTML, escapeJS } from "@src/utils/string.ts";
import { expect } from "@std/expect";

Deno.test("[unit] string", async ( test ) => {
  await test.step("[scenario] escapeHTML", async ( test ) => {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    await test.step("[case] should return original Uint8Array when no HTML characters exist", () => {
      const input = encoder.encode( '"hello world"' );
      const result = escapeHTML( input );

      expect( result ).toBe( input );
    });

    await test.step("[case] should escape <, >, and & into \\uXXXX sequences", () => {
      const input = encoder.encode( '"<tag attr=\\"a&b\\">text</tag>"' );
      const result = escapeHTML( input );

      expect( decoder.decode( result ) ).toBe(
        '"\\u003ctag attr=\\"a\\u0026b\\"\\u003etext\\u003c/tag\\u003e"',
      );
    });

    await test.step("[case] should handle target characters at boundaries without quotes", () => {
      const input = encoder.encode( "<&>" );
      const result = escapeHTML( input );

      expect( decoder.decode( result ) ).toBe( "\\u003c\\u0026\\u003e" );
    });
  });

  await test.step("[scenario] escapeJS", async ( test ) => {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    await test.step("[case] should return original Uint8Array when no JS line terminators exist", () => {
      const input = new Uint8Array( [ 0x22, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x94, 0x22 ] );
      const result = escapeJS( input );

      expect( result ).toBe( input );
    });

    await test.step("[case] should escape U+2028 and U+2029 into \\u2028 and \\u2029", () => {
      const input = encoder.encode( '"line\u2028para\u2029end"' );
      const result = escapeJS( input );

      expect( decoder.decode( result ) ).toBe( '"line\\u2028para\\u2029end"' );
    });

    await test.step("[case] should handle target sequences at boundaries", () => {
      const input = encoder.encode( "\u2028\u2029" );
      const result = escapeJS( input );

      expect( decoder.decode( result ) ).toBe( "\\u2028\\u2029" );
    });
  });
});
