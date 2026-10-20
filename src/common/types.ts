export type JSONStructuralCharacter =
  | "begin-array"
  | "begin-object"
  | "end-array"
  | "end-object"
  | "name-separator"
  | "value-separator";

export type JSONValue = "true" | "false" | "null" | "string" | "number" | "object" | "array";

export type JSONPrimitiveValue = "true" | "false" | "null" | "string" | "number";

export type JSONReferenceValue = "object" | "array";

export type JSONTextKind = "structural" | "value";
