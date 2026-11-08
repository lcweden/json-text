import Tracker from "@src/modules/tracker.ts";
import { expect } from "@std/expect";

Deno.test("[unit] tracker", async ( test ) => {
  await test.step("[scenario] initial state and lifecycle", async ( test ) => {
    await test.step("[case] should initialize with depth 0 and empty names", () => {
      const tracker = new Tracker();

      expect( tracker.depth ).toBe( 0 );
      expect( tracker.lastName ).toBe( "" );
      expect( tracker.getName( 0 ) ).toBe( "" );
    });

    await test.step("[case] should safely ignore pop when depth is 0", () => {
      const tracker = new Tracker();

      tracker.pop();

      expect( tracker.depth ).toBe( 0 );
      expect( tracker.lastName ).toBe( "" );
    });

    await test.step("[case] should reset active scopes and depth", () => {
      const tracker = new Tracker();

      tracker.push();

      expect( tracker.setName( "a", true ) ).toBe( true );

      tracker.push();

      expect( tracker.setName( "b", true ) ).toBe( true );
      expect( tracker.depth ).toBe( 2 );
      expect( tracker.lastName ).toBe( "b" );

      tracker.reset();

      expect( tracker.depth ).toBe( 0 );
      expect( tracker.lastName ).toBe( "" );

      tracker.push();

      expect( tracker.setName( "a", true ) ).toBe( true );

      tracker.push();

      expect( tracker.setName( "b", true ) ).toBe( true );
    });
  });

  await test.step("[scenario] scope management and duplicate detection", async ( test ) => {
    await test.step("[case] should track names and enforce uniqueness when unique is true", () => {
      const tracker = new Tracker();

      tracker.push();

      expect( tracker.depth ).toBe( 1 );
      expect( tracker.lastName ).toBe( "" );

      expect( tracker.setName( "first", true ) ).toBe( true );
      expect( tracker.lastName ).toBe( "first" );
      expect( tracker.getName( 0 ) ).toBe( "first" );

      expect( tracker.setName( "second", true ) ).toBe( true );
      expect( tracker.lastName ).toBe( "second" );
      expect( tracker.getName( 0 ) ).toBe( "second" );

      expect( tracker.setName( "first", true ) ).toBe( false );
      expect( tracker.lastName ).toBe( "first" );
    });

    await test.step("[case] should allow duplicate names when unique is false", () => {
      const tracker = new Tracker();

      tracker.push();

      expect( tracker.setName( "dup", false ) ).toBe( true );
      expect( tracker.setName( "dup", false ) ).toBe( true );
      expect( tracker.lastName ).toBe( "dup" );
    });

    await test.step("[case] should isolate scopes across nested objects and reuse cleared sets after pop", () => {
      const tracker = new Tracker();

      tracker.push();

      expect( tracker.setName( "shared", true ) ).toBe( true );

      tracker.push();

      expect( tracker.depth ).toBe( 2 );
      expect( tracker.lastName ).toBe( "" );
      expect( tracker.setName( "shared", true ) ).toBe( true );
      expect( tracker.setName( "inner", true ) ).toBe( true );
      expect( tracker.getName( 0 ) ).toBe( "shared" );
      expect( tracker.getName( 1 ) ).toBe( "inner" );

      tracker.pop();

      expect( tracker.depth ).toBe( 1 );
      expect( tracker.lastName ).toBe( "shared" );
      expect( tracker.setName( "shared", true ) ).toBe( false );

      tracker.push();

      expect( tracker.depth ).toBe( 2 );
      expect( tracker.setName( "inner", true ) ).toBe( true );

      tracker.pop();
      tracker.pop();

      expect( tracker.depth ).toBe( 0 );
    });
  });
});
