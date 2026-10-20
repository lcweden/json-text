import Grammar from "@src/modules/grammar.ts";
import { expect } from "@std/expect";

Deno.test("[unit] grammar", async ( test ) => {
  await test.step("[scenario] top-level scalar value lifecycle", () => {
    const grammar = new Grammar( 1 );

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( false );
    expect( grammar.type ).toBeUndefined();
    expect( grammar.step ).toBeUndefined();
    expect( grammar.index ).toBe( -1 );

    grammar.stepValue();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
    expect( grammar.type ).toBeUndefined();

    expect( () => grammar.stepValue() )
      .toThrow( "Unexpected non-whitespace character after JSON data" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Unexpected non-whitespace character after JSON data" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Unexpected non-whitespace character after JSON data" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Unexpected non-whitespace character after JSON data" );

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Unexpected non-whitespace character after JSON data" );

    grammar.reset();

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Unexpected character" );
  });

  await test.step("[scenario] array lifecycle, step transitions, and index tracking", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginArray();

    expect( grammar.depth ).toBe( 1 );
    expect( grammar.type ).toBe( "array" );
    expect( grammar.index ).toBe( 0 );
    expect( grammar.step ).toBe( 1 );

    grammar.stepValue();

    expect( grammar.index ).toBe( 0 );
    expect( grammar.step ).toBe( 2 );

    grammar.stepValueSeparator();

    expect( grammar.index ).toBe( 1 );
    expect( grammar.step ).toBe( 1 );

    grammar.stepValue();

    expect( grammar.index ).toBe( 1 );
    expect( grammar.step ).toBe( 2 );

    grammar.stepEndArray();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
    expect( grammar.type ).toBeUndefined();
    expect( grammar.index ).toBe( -1 );
  });

  await test.step("[scenario] empty array handling", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginArray();

    expect( grammar.step ).toBe( 1 );

    grammar.stepEndArray();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
  });

  await test.step("[scenario] array syntax violations", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginArray();
    grammar.stepValue();

    expect( () => grammar.stepValue() )
      .toThrow( "Expected ',' or ']' after array element" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Expected ',' or ']' after array element" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Expected ',' or ']' after array element" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Expected ',' or ']' after array element" );

    grammar.reset();
    grammar.stepBeginArray();

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Unexpected character" );

    grammar.reset();
    grammar.stepBeginArray();
    grammar.stepValue();
    grammar.stepValueSeparator();

    expect( () => grammar.stepEndArray() )
      .toThrow( "Unexpected character" );

    grammar.reset();
    grammar.stepBeginArray();

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Unexpected character" );

    grammar.reset();
    grammar.stepBeginArray();
    grammar.stepValue();
    grammar.stepValueSeparator();

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Unexpected character" );

    grammar.reset();

    expect( () => grammar.stepEndArray() )
      .toThrow( "Unexpected character" );
  });

  await test.step("[scenario] object lifecycle and 4-phase micro-steps", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginObject();

    expect( grammar.depth ).toBe( 1 );
    expect( grammar.type ).toBe( "object" );
    expect( grammar.step ).toBe( 1 );

    grammar.stepName();

    expect( grammar.step ).toBe( 2 );

    grammar.stepNameSeparator();

    expect( grammar.step ).toBe( 3 );

    grammar.stepValue();

    expect( grammar.step ).toBe( 4 );

    grammar.stepValueSeparator();

    expect( grammar.step ).toBe( 1 );

    grammar.stepName();

    expect( grammar.step ).toBe( 2 );

    grammar.stepNameSeparator();

    expect( grammar.step ).toBe( 3 );

    grammar.stepValue();

    expect( grammar.step ).toBe( 4 );

    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
    expect( grammar.type ).toBeUndefined();
  });

  await test.step("[scenario] empty object handling", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginObject();

    expect( grammar.step ).toBe( 1 );

    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
  });

  await test.step("[scenario] object syntax violations", () => {
    const grammar = new Grammar( 1 );

    grammar.stepBeginObject();

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Expected property name or '}'" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Expected property name or '}'" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Expected property name or '}'" );

    expect( () => grammar.stepValue() )
      .toThrow( "Expected property name or '}'" );

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Expected property name or '}'" );

    grammar.reset();
    grammar.stepBeginObject();
    grammar.stepName();
    grammar.stepNameSeparator();
    grammar.stepValue();
    grammar.stepValueSeparator();

    expect( () => grammar.stepEndObject() )
      .toThrow( "Expected double-quoted property name" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Expected double-quoted property name" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Expected double-quoted property name" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Expected double-quoted property name" );

    expect( () => grammar.stepValue() )
      .toThrow( "Expected double-quoted property name" );

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Expected double-quoted property name" );

    grammar.reset();
    grammar.stepBeginObject();
    grammar.stepName();

    expect( () => grammar.stepValue() )
      .toThrow( "Expected ':' after property name in object" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Expected ':' after property name in object" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Expected ':' after property name in object" );

    expect( () => grammar.stepName() )
      .toThrow( "Expected ':' after property name in object" );

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Expected ':' after property name in object" );

    expect( () => grammar.stepEndObject() )
      .toThrow( "Expected ':' after property name in object" );

    grammar.reset();
    grammar.stepBeginObject();
    grammar.stepName();
    grammar.stepNameSeparator();

    expect( () => grammar.stepName() )
      .toThrow( "Unexpected character" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Unexpected character" );

    expect( () => grammar.stepValueSeparator() )
      .toThrow( "Unexpected character" );

    expect( () => grammar.stepEndObject() )
      .toThrow( "Unexpected character" );

    grammar.stepValue();

    expect( () => grammar.stepName() )
      .toThrow( "Expected ',' or '}' after property value in object" );

    expect( () => grammar.stepBeginArray() )
      .toThrow( "Expected ',' or '}' after property value in object" );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Expected ',' or '}' after property value in object" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Expected ',' or '}' after property value in object" );

    expect( () => grammar.stepValue() )
      .toThrow( "Expected ',' or '}' after property value in object" );

    grammar.reset();

    expect( () => grammar.stepName() )
      .toThrow( "Unexpected character" );

    expect( () => grammar.stepNameSeparator() )
      .toThrow( "Unexpected character" );

    expect( () => grammar.stepEndObject() )
      .toThrow( "Unexpected character" );
  });

  await test.step("[scenario] nested structures and parent stack restoration", () => {
    const grammar = new Grammar( 4 );

    grammar.stepBeginObject();

    expect( grammar.depth ).toBe( 1 );

    grammar.stepName();
    grammar.stepNameSeparator();

    expect( grammar.step ).toBe( 3 );

    grammar.stepBeginArray();

    expect( grammar.depth ).toBe( 2 );
    expect( grammar.type ).toBe( "array" );
    expect( grammar.index ).toBe( 0 );
    expect( grammar.step ).toBe( 1 );

    grammar.stepBeginObject();

    expect( grammar.depth ).toBe( 3 );
    expect( grammar.type ).toBe( "object" );

    grammar.stepName();
    grammar.stepNameSeparator();
    grammar.stepBeginObject();

    expect( grammar.depth ).toBe( 4 );
    expect( grammar.type ).toBe( "object" );

    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 3 );
    expect( grammar.type ).toBe( "object" );
    expect( grammar.step ).toBe( 4 );

    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 2 );
    expect( grammar.type ).toBe( "array" );
    expect( grammar.index ).toBe( 0 );
    expect( grammar.step ).toBe( 2 );

    grammar.stepValueSeparator();

    expect( grammar.index ).toBe( 1 );

    grammar.stepBeginArray();

    expect( grammar.depth ).toBe( 3 );
    expect( grammar.type ).toBe( "array" );

    grammar.stepEndArray();

    expect( grammar.depth ).toBe( 2 );
    expect( grammar.type ).toBe( "array" );
    expect( grammar.index ).toBe( 1 );
    expect( grammar.step ).toBe( 2 );

    grammar.stepEndArray();

    expect( grammar.depth ).toBe( 1 );
    expect( grammar.type ).toBe( "object" );
    expect( grammar.step ).toBe( 4 );

    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
  });

  await test.step("[scenario] maximum nesting depth enforcement", () => {
    const grammar = new Grammar( 2 );

    grammar.stepBeginArray();
    grammar.stepBeginObject();

    expect( grammar.depth ).toBe( 2 );

    grammar.stepName();
    grammar.stepNameSeparator();

    expect( () => grammar.stepBeginArray() )
      .toThrow( RangeError );

    expect( () => grammar.stepBeginObject() )
      .toThrow( "Maximum nesting depth exceeded" );

    grammar.stepValue();
    grammar.stepEndObject();

    expect( grammar.depth ).toBe( 1 );

    grammar.stepValueSeparator();
    grammar.stepBeginArray();

    expect( grammar.depth ).toBe( 2 );

    grammar.stepEndArray();
    grammar.stepEndArray();

    expect( grammar.depth ).toBe( 0 );
    expect( grammar.ended ).toBe( true );
  });
});
