export type JSONStructuralCharacter =
  | "begin-array"
  | "begin-object"
  | "end-array"
  | "end-object"
  | "name-separator"
  | "value-separator";

export type JSONPrimitiveValue = "true" | "false" | "null" | "string" | "number";

export type JSONReferenceValue = "object" | "array";

export type JSONValue = JSONPrimitiveValue | JSONReferenceValue;
