import JSONTextReader from "@src/api/reader.ts";
import { expect } from "@std/expect";

Deno.test("[unit] reader", async ( test ) => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  await test.step("[scenario] constructor and options", async ( test ) => {
    await test.step("[case] should initialize with default state", () => {
      const reader = new JSONTextReader();

      expect( reader.depth ).toBe( 0 );
      expect( reader.done ).toBe( false );
      expect( reader.offset ).toBe( 0 );
      expect( reader.peekKind() ).toBeUndefined();
      expect( reader.readToken() ).toBeUndefined();
    });

    await test.step("[case] should accept initial chunk in constructor", () => {
      const reader = new JSONTextReader( encoder.encode( "true" ) );

      reader.close();

      expect( reader.peekKind() ).toBe( "true" );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "true" );
      expect( reader.done ).toBe( true );
      expect( reader.readToken() ).toBeUndefined();
    });

    await test.step("[case] should throw TypeError when options receive invalid types", () => {
      const chunk = new Uint8Array();

      expect( () => new JSONTextReader( chunk, { allowDuplicateNames: 1 as unknown as boolean } ) )
        .toThrow( TypeError );

      expect( () => new JSONTextReader( chunk, { allowInvalidUTF8: 1 as unknown as boolean } ) )
        .toThrow( TypeError );

      expect( () => new JSONTextReader( chunk, { maxDepth: "10" as unknown as number } ) )
        .toThrow( TypeError );
    });

    await test.step("[case] should throw RangeError when maxDepth is negative, fractional, or NaN", () => {
      const chunk = new Uint8Array();

      expect( () => new JSONTextReader( chunk, { maxDepth: -1 } ) ).toThrow( RangeError );
      expect( () => new JSONTextReader( chunk, { maxDepth: 1.5 } ) ).toThrow( RangeError );
      expect( () => new JSONTextReader( chunk, { maxDepth: NaN } ) ).toThrow( RangeError );
    });

    await test.step("[case] should enforce allowDuplicateNames option", () => {
      const chunk = encoder.encode( '{"a":1,"a":2}' );
      let reader = new JSONTextReader( chunk );

      reader.close();

      expect( () => Array.from( reader ) ).toThrow( "Duplicate object name a" );

      reader.reset();

      reader = new JSONTextReader( chunk, { allowDuplicateNames: true } );

      reader.close();

      expect( Array.from( reader ).length ).toBe( 9 );
    });

    await test.step("[case] should enforce allowInvalidUTF8 option", () => {
      const chunk = new Uint8Array( [ 0x22, 0xFF, 0x22 ] );
      let reader = new JSONTextReader( chunk );

      reader.close();

      expect( () => reader.readToken() ).toThrow( TypeError );

      reader.reset();

      reader = new JSONTextReader( chunk, { allowInvalidUTF8: true } );

      reader.close();

      expect( reader.readToken() ).toEqual( chunk );
    });

    await test.step("[case] should enforce maxDepth option on arrays", () => {
      const reader = new JSONTextReader( encoder.encode( "[[1]]" ), { maxDepth: 1 } );

      reader.close();
      reader.readToken();

      expect( () => reader.readToken() ).toThrow( RangeError );
    });

    await test.step("[case] should enforce maxDepth option on objects", () => {
      const reader = new JSONTextReader( encoder.encode( '{"a":{}}' ), { maxDepth: 1 } );

      reader.close();
      reader.readToken();
      reader.readToken();
      reader.readToken();

      expect( () => reader.readToken() ).toThrow( RangeError );
    });
  });

  await test.step("[scenario] peekKind", async ( test ) => {
    await test.step("[case] should return token kind and advance offset past leading whitespace", () => {
      const reader = new JSONTextReader( encoder.encode( "   true" ) );

      reader.close();

      expect( reader.peekKind() ).toBe( "true" );
      expect( reader.offset ).toBe( 3 );
    });

    await test.step("[case] should throw SyntaxError on unexpected EOF", () => {
      const reader = new JSONTextReader();

      reader.close();

      expect( () => reader.peekKind() ).toThrow( "Unexpected end of data" );
    });

    await test.step("[case] should throw SyntaxError on trailing data", () => {
      const reader = new JSONTextReader( encoder.encode( "1 2" ) );

      reader.close();
      reader.readToken();

      expect( () => reader.peekKind() )
        .toThrow( "Unexpected non-whitespace character after JSON data" );
    });

    await test.step("[case] should throw SyntaxError on invalid byte", () => {
      const reader = new JSONTextReader( encoder.encode( "#" ) );

      reader.close();

      expect( () => reader.peekKind() ).toThrow( "Unexpected character" );
    });
  });

  await test.step("[scenario] readToken and iterator", async ( test ) => {
    await test.step("[case] should read primitive tokens (null, true, false, number, string)", () => {
      const reader = new JSONTextReader();

      reader.push( encoder.encode( "null" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "null" );

      reader.reset();
      reader.push( encoder.encode( "true" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "true" );

      reader.reset();
      reader.push( encoder.encode( "false" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "false" );

      reader.reset();
      reader.push( encoder.encode( "-12.5" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "-12.5" );

      reader.reset();
      reader.push( encoder.encode( '"str"' ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( '"str"' );
    });

    await test.step("[case] should iterate over structural and primitive tokens", () => {
      const reader = new JSONTextReader( encoder.encode( '{"a":[1]}' ) );

      reader.close();

      const tokens = Array.from( reader, ( bytes ) => decoder.decode( bytes ) );

      expect( tokens ).toEqual( [ "{", '"a"', ":", "[", "1", "]", "}" ] );
      expect( reader.done ).toBe( true );
      expect( reader.depth ).toBe( 0 );
    });

    await test.step("[case] should return undefined when token is incomplete and not closed", () => {
      expect( new JSONTextReader( encoder.encode( '"a' ) ).readToken() ).toBeUndefined();
      expect( new JSONTextReader( encoder.encode( "1." ) ).readToken() ).toBeUndefined();
      expect( new JSONTextReader( encoder.encode( "12" ) ).readToken() ).toBeUndefined();
      expect( new JSONTextReader( encoder.encode( "tru" ) ).readToken() ).toBeUndefined();
      expect( new JSONTextReader( encoder.encode( "fal" ) ).readToken() ).toBeUndefined();
      expect( new JSONTextReader( encoder.encode( "nul" ) ).readToken() ).toBeUndefined();
    });

    await test.step("[case] should throw SyntaxError on truncated tokens when closed", () => {
      const reader = new JSONTextReader();

      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unexpected end of data" );

      reader.reset();
      reader.push( encoder.encode( '"unterminated' ) );
      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unterminated string literal" );

      reader.reset();
      reader.push( encoder.encode( "1." ) );
      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unexpected end of data" );

      reader.reset();
      reader.push( encoder.encode( "tru" ) );
      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );

      reader.reset();
      reader.push( encoder.encode( "fals" ) );
      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );

      reader.reset();
      reader.push( encoder.encode( "nul" ) );
      reader.close();

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );
    });

    await test.step("[case] should throw SyntaxError on malformed tokens", () => {
      const reader = new JSONTextReader();

      reader.push( encoder.encode( '"\n"' ) );

      expect( () => reader.readToken() ).toThrow( "Bad character in string literal" );

      reader.reset();
      reader.push( encoder.encode( "01" ) );

      expect( () => reader.readToken() ).toThrow( "Unexpected non-digit" );

      reader.reset();
      reader.push( encoder.encode( "trux" ) );

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );

      reader.reset();
      reader.push( encoder.encode( "falx" ) );

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );

      reader.reset();
      reader.push( encoder.encode( "nulx" ) );

      expect( () => reader.readToken() ).toThrow( "Unexpected keyword" );

      reader.reset();
      reader.push( encoder.encode( "@" ) );

      expect( () => reader.readToken() ).toThrow( "Unexpected character" );
    });
  });

  await test.step("[scenario] readValue and skipValue", async ( test ) => {
    await test.step("[case] should read scalar and composite values", () => {
      const reader = new JSONTextReader( encoder.encode( '[42,{"a":[1,2]}]' ) );

      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "[" );
      expect( decoder.decode( reader.readValue()! ) ).toBe( "42" );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "," );
      expect( decoder.decode( reader.readValue()! ) ).toBe( '{"a":[1,2]}' );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "]" );
      expect( reader.done ).toBe( true );
      expect( reader.readValue() ).toBeUndefined();
    });

    await test.step("[case] should skip scalar and composite values", () => {
      const reader = new JSONTextReader( encoder.encode( '[1,{"a":[2,3]},4]' ) );

      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "[" );
      expect( reader.skipValue() ).toBe( true );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "," );
      expect( reader.skipValue() ).toBe( true );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "," );
      expect( decoder.decode( reader.readValue()! ) ).toBe( "4" );
      expect( decoder.decode( reader.readToken()! ) ).toBe( "]" );
      expect( reader.done ).toBe( true );
      expect( reader.skipValue() ).toBe( false );
    });

    await test.step("[case] should resume readValue across chunks", () => {
      const reader = new JSONTextReader();

      reader.push( encoder.encode( '"a' ) );

      expect( reader.readValue() ).toBeUndefined();

      reader.reset();
      reader.push( encoder.encode( " [1," ) );

      expect( reader.readValue() ).toBeUndefined();

      reader.push( encoder.encode( "2]" ) );
      reader.close();

      expect( decoder.decode( reader.readValue()! ) ).toBe( "[1,2]" );
    });

    await test.step("[case] should throw SyntaxError when called in non-value grammar positions", () => {
      const reader = new JSONTextReader();

      reader.push( encoder.encode( '{"a":1}' ) );
      reader.close();
      reader.readToken();

      expect( () => reader.readValue() ).toThrow( "Expected property name or '}'" );

      reader.reset();
      reader.push( encoder.encode( '{"a":1}' ) );
      reader.close();
      reader.readToken();
      reader.readToken();

      expect( () => reader.skipValue() ).toThrow( "Expected ':' after property name in object" );

      reader.reset();
      reader.push( encoder.encode( "[]" ) );
      reader.close();
      reader.readToken();

      expect( () => reader.readValue() ).toThrow( "Unexpected character" );
    });
  });

  await test.step("[scenario] stream lifecycle (push, close, reset)", async ( test ) => {
    await test.step("[case] should complete pending number after push and close", () => {
      const reader = new JSONTextReader( encoder.encode( "12" ) );

      expect( reader.readToken() ).toBeUndefined();

      reader.push( encoder.encode( "3" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "123" );
      expect( reader.done ).toBe( true );
    });

    await test.step("[case] should throw Error when pushing to a closed reader", () => {
      const reader = new JSONTextReader();

      reader.close();

      expect( () => reader.push( encoder.encode( "123" ) ) )
        .toThrow( "Cannot push to a closed reader" );
    });

    await test.step("[case] should reset reader state for reuse", () => {
      const reader = new JSONTextReader( encoder.encode( "[1" ) );

      expect( decoder.decode( reader.readToken()! ) ).toBe( "[" );
      expect( reader.depth ).toBe( 1 );

      reader.reset();

      expect( reader.depth ).toBe( 0 );
      expect( reader.done ).toBe( false );
      expect( reader.offset ).toBe( 0 );

      reader.push( encoder.encode( "true" ) );
      reader.close();

      expect( decoder.decode( reader.readToken()! ) ).toBe( "true" );
      expect( reader.done ).toBe( true );
    });
  });
});
