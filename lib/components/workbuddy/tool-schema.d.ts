/**
 * WorkBuddy's models reject several JSON Schema spellings that DSH (and other
 * OpenAI-compatible clients) emit. WorkBuddy AI answers 400 code 11133
 * "Invalid request parameters" to tools it cannot pass on: DeepSeek's models
 * turn away every shape below, Kimi's, GPT's, Gemini's and GLM's some of them.
 *
 * Every transformation here keeps the schema's meaning: nothing is narrowed or
 * widened, except an empty enum (which nothing fits) is left out. The logic
 * and its comments follow magpie's `packages/workbuddy` (MIT), where each rule
 * was measured against a real account.
 */
type Schema = Record<string, unknown>;
/** `name` with each character WorkBuddy refuses as `_`, kept apart from `taken`. */
export declare function safeName(name: string, taken: Set<string>): string;
/**
 * Mend a schema in place at every depth: a pattern's `\0`, which DeepSeek's
 * validator calls "not a 'regex'", becomes `\u0000`, which matches the same; a
 * tuple's `items` (a list) becomes one schema any of them fits.
 */
export declare function fitSchema(schema: unknown, depth?: number): boolean;
/**
 * Mend `s`, a schema, and each schema under it: unknown or mis-cased `type`
 * values, a `required` that isn't a list of names, an enum without a usable
 * type, and boolean sub-schemas. A name under `properties` is never read as a
 * keyword.
 */
export declare function fitShape(schema: unknown, depth?: number): boolean;
/**
 * Make a tool's parameters an object at the root: `allOf`'s branches are
 * merged whole; of `anyOf`'s and `oneOf`'s object branches the properties are
 * merged and a field each requires stays required. A root with no type, or an
 * empty one, is an object.
 */
export declare function objectRoot(ps: Schema, root?: Schema, depth?: number): boolean;
/**
 * Give a `oneOf` with no type the type `object` when every branch is typed
 * object itself or through a chain of local `$ref`s. Kimi answers 400 "Invalid
 * request parameters" to such unions even when every branch is an object (DSH's
 * REA tools did).
 */
export declare function typeUnions(schema: unknown, root?: Schema, depth?: number): boolean;
/** The parts of a chat body this module touches. */
export interface ToolBody {
    tools?: unknown;
    messages?: unknown;
    tool_choice?: unknown;
}
/**
 * Mend a chat body's function tools in place: their parameters and their names.
 * Returns whether it changed anything, and the names it gave (each to the name
 * the client knows), so the model's calls can be named back. A call in the
 * chat's history is named as its tool now is.
 */
export declare function fitTools(body: ToolBody): {
    changed: boolean;
    names: Map<string, string>;
};
export {};
