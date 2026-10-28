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

type Schema = Record<string, unknown>

const object = (value: unknown): value is Schema =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** A tool's name may hold letters, digits, `_` and `-`; another character is refused. */
const NAME_OK = /^[A-Za-z0-9_-]+$/

/** `name` with each character WorkBuddy refuses as `_`, kept apart from `taken`. */
export function safeName(name: string, taken: Set<string>): string {
  const base = name.replace(/[^A-Za-z0-9_-]/g, '_') || 'tool'
  let wire = base
  for (let i = 2; taken.has(wire); i++) wire = `${base}_${i}`
  taken.add(wire)
  return wire
}

/** A regex's `\0` (the NUL character), stepping over each `\\` so that `\\0` is left. */
const NUL_ESCAPE = /\\\\|\\0(?![0-9])/g

/**
 * Mend a schema in place at every depth: a pattern's `\0`, which DeepSeek's
 * validator calls "not a 'regex'", becomes `\u0000`, which matches the same; a
 * tuple's `items` (a list) becomes one schema any of them fits.
 */
export function fitSchema(schema: unknown, depth = 0): boolean {
  if (!schema || typeof schema !== 'object' || depth > 64) return false
  let changed = false
  if (Array.isArray(schema)) {
    for (const value of schema) if (fitSchema(value, depth + 1)) changed = true
    return changed
  }
  const s = schema as Schema
  if (typeof s.pattern === 'string' && s.pattern.includes('\\0')) {
    const pattern = s.pattern.replace(NUL_ESCAPE, match => (match === '\\\\' ? match : '\\u0000'))
    if (pattern !== s.pattern) {
      s.pattern = pattern
      changed = true
    }
  }
  if (Array.isArray(s.items)) {
    const list = s.items.filter(object)
    s.items = list.length === 0 ? {} : list.length === 1 ? list[0] : { anyOf: list }
    delete s.additionalItems
    changed = true
  }
  for (const value of Object.values(s)) if (fitSchema(value, depth + 1)) changed = true
  return changed
}

/** The JSON Schema types WorkBuddy's models accept as `type`. */
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'])

/** Keywords whose value is a schema, a list of schemas, or a map of names to schemas. */
const SUB_ONE = ['items', 'additionalItems', 'unevaluatedItems', 'contains', 'not', 'if', 'then', 'else',
  'propertyNames', 'additionalProperties', 'unevaluatedProperties']
const SUB_LIST = ['anyOf', 'oneOf', 'allOf', 'prefixItems']
const SUB_MAP = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']
/** These two are left as `true`/`false` where they are booleans. */
const BOOL_OK = new Set(['additionalProperties', 'unevaluatedProperties'])

/** The JSON Schema type of an enum's value. */
function valueType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

/**
 * Give `s`'s enum a type: the one its values have, or that and `"null"`; values
 * of several types become an `anyOf` of an enum for each.
 */
function fitEnum(s: Schema): boolean {
  if (!('enum' in s)) return false
  if (!Array.isArray(s.enum) || s.enum.length === 0) {
    delete s.enum
    return true
  }
  const listed = Array.isArray(s.type) ? s.type : typeof s.type === 'string' ? [s.type] : []
  if (listed.filter(type => type !== 'null').length === 1) return false
  const byType = new Map<string, unknown[]>()
  for (const value of s.enum) {
    const type = valueType(value)
    const list = byType.get(type)
    if (list) list.push(value)
    else byType.set(type, [value])
  }
  if (byType.has('integer') && byType.has('number')) {
    byType.get('number')!.push(...byType.get('integer')!)
    byType.delete('integer')
  }
  const hasNull = byType.delete('null')
  if (byType.size <= 1) {
    const [only] = byType.keys()
    const want = only === undefined ? 'null' : hasNull ? [only, 'null'] : only
    if (JSON.stringify(want) === JSON.stringify(s.type)) return false
    s.type = want
    return true
  }
  const split: Schema[] = [...byType].map(([type, values]) => ({ type, enum: values }))
  if (hasNull) split.push({ type: 'null' })
  delete s.enum
  delete s.type
  if (Array.isArray(s.anyOf)) s.allOf = [...(Array.isArray(s.allOf) ? s.allOf : []), { anyOf: split }]
  else s.anyOf = split
  return true
}

/** `value`, a schema found under `key`, as an object the models take: `true` is `{}`, `false` is `{"not": {}}`. */
function subSchema(value: unknown, key: string): unknown {
  if (typeof value !== 'boolean' || BOOL_OK.has(key)) return value
  return value ? {} : { not: {} }
}

/**
 * Mend `s`, a schema, and each schema under it: unknown or mis-cased `type`
 * values, a `required` that isn't a list of names, an enum without a usable
 * type, and boolean sub-schemas. A name under `properties` is never read as a
 * keyword.
 */
export function fitShape(schema: unknown, depth = 0): boolean {
  if (!object(schema) || depth > 64) return false
  const s = schema
  let changed = false
  if ('type' in s) {
    const list = (Array.isArray(s.type) ? s.type : [s.type])
      .map(type => (typeof type === 'string' ? type.toLowerCase() : type))
      .filter(type => TYPES.has(type as string))
    const unique = [...new Set(list)]
    const want = unique.length === 0 ? undefined : unique.length === 1 ? unique[0] : unique
    if (JSON.stringify(want) !== JSON.stringify(s.type)) {
      if (want === undefined) delete s.type
      else s.type = want
      changed = true
    }
  }
  if ('required' in s && !Array.isArray(s.required)) {
    delete s.required
    changed = true
  } else if (Array.isArray(s.required) && s.required.some(key => typeof key !== 'string')) {
    s.required = s.required.filter(key => typeof key === 'string')
    changed = true
  }
  if (fitEnum(s)) changed = true
  for (const key of SUB_ONE) {
    if (!(key in s)) continue
    const value = subSchema(s[key], key)
    if (value !== s[key]) {
      s[key] = value
      changed = true
    }
    if (fitShape(value, depth + 1)) changed = true
  }
  for (const key of SUB_LIST) {
    if (!Array.isArray(s[key])) continue
    s[key].forEach((item, index) => {
      const value = subSchema(item, key)
      if (value !== item) {
        ;(s[key] as unknown[])[index] = value
        changed = true
      }
      if (fitShape(value, depth + 1)) changed = true
    })
  }
  for (const key of SUB_MAP) {
    const map = s[key]
    if (!object(map)) continue
    for (const [name, item] of Object.entries(map)) {
      const value = subSchema(item, key)
      if (value !== item) {
        map[name] = value
        changed = true
      }
      if (fitShape(value, depth + 1)) changed = true
    }
  }
  return changed
}

/** The schema a local `$ref` in `root` names (`#/$defs/x`, `#/definitions/x`), or `s` itself. */
function localRef(root: Schema, s: Schema): Schema {
  const ref = s.$ref
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return s
  let at: unknown = root
  for (const key of ref.slice(2).split('/')) {
    at = object(at) ? at[key.replaceAll('~1', '/').replaceAll('~0', '~')] : undefined
  }
  return object(at) ? at : s
}

/**
 * Make a tool's parameters an object at the root: `allOf`'s branches are
 * merged whole; of `anyOf`'s and `oneOf`'s object branches the properties are
 * merged and a field each requires stays required. A root with no type, or an
 * empty one, is an object.
 */
export function objectRoot(ps: Schema, root: Schema = ps, depth = 0): boolean {
  const unions = ['allOf', 'anyOf', 'oneOf'].filter(key => Array.isArray(ps[key]))
  if (ps.type === 'object' && !unions.length) return false
  const props: Schema = object(ps.properties) ? ps.properties : {}
  const required: unknown[] = Array.isArray(ps.required) ? [...ps.required] : []
  for (const branch of (ps.allOf as unknown[] | undefined) ?? []) {
    let b = localRef(root, object(branch) ? branch : {})
    if (!object(b)) continue
    if (depth < 8 && ['allOf', 'anyOf', 'oneOf'].some(key => Array.isArray(b[key]))) {
      b = structuredClone(b)
      objectRoot(b, root, depth + 1)
    }
    for (const [key, value] of Object.entries(object(b.properties) ? b.properties : {})) {
      if (!(key in props)) props[key] = value
    }
    if (Array.isArray(b.required)) required.push(...b.required)
  }
  const branches: Schema[] = []
  for (const key of ['anyOf', 'oneOf']) {
    for (const branch of (ps[key] as unknown[] | undefined) ?? []) {
      let b = localRef(root, object(branch) ? branch : {})
      if (!object(b)) continue
      if (depth < 8 && ['allOf', 'anyOf', 'oneOf'].some(name => Array.isArray(b[name]))) {
        b = structuredClone(b)
        objectRoot(b, root, depth + 1)
      }
      if (b.type !== 'object' && !b.properties) continue
      branches.push(b)
    }
  }
  const from = new Map<string, unknown[]>()
  for (const branch of branches) {
    for (const [key, value] of Object.entries(object(branch.properties) ? branch.properties : {})) {
      if (key in props) continue
      const seen = from.get(key) ?? []
      if (!seen.some(item => JSON.stringify(item) === JSON.stringify(value))) seen.push(value)
      from.set(key, seen)
    }
  }
  for (const [key, list] of from) props[key] = list.length === 1 ? list[0] : { anyOf: list }
  if (branches.length) {
    for (const key of Object.keys(object(branches[0].properties) ? branches[0].properties : {})) {
      if (branches.every(branch => Array.isArray(branch.required) && branch.required.includes(key))) {
        required.push(key)
      }
    }
  }
  for (const key of unions) delete ps[key]
  ps.type = 'object'
  ps.properties = props
  const req = [...new Set(required)].filter(key => typeof key === 'string' && key in props)
  if (req.length) ps.required = req
  else delete ps.required
  return true
}

/** Whether `b` is typed object, itself or where its local `$ref`s lead; a `$ref` seen before is a cycle, and not. */
function objectBranch(root: Schema, b: unknown, seen: string[] = []): boolean {
  if (!object(b)) return false
  if ('type' in b) return b.type === 'object'
  if (typeof b.$ref !== 'string' || seen.includes(b.$ref) || seen.length > 16) return false
  const target = localRef(root, b)
  return target !== b && objectBranch(root, target, [...seen, b.$ref])
}

/**
 * Give a `oneOf` with no type the type `object` when every branch is typed
 * object itself or through a chain of local `$ref`s. Kimi answers 400 "Invalid
 * request parameters" to such unions even when every branch is an object (DSH's
 * REA tools did).
 */
export function typeUnions(schema: unknown, root: Schema = object(schema) ? schema : {}, depth = 0): boolean {
  if (!object(schema) || depth > 64) return false
  let changed = false
  if (!('type' in schema) && Array.isArray(schema.oneOf) && schema.oneOf.length
    && schema.oneOf.every(branch => objectBranch(root, branch))) {
    schema.type = 'object'
    changed = true
  }
  for (const key of SUB_ONE) if (typeUnions(schema[key], root, depth + 1)) changed = true
  for (const key of SUB_LIST) {
    for (const value of Array.isArray(schema[key]) ? schema[key] as unknown[] : []) {
      if (typeUnions(value, root, depth + 1)) changed = true
    }
  }
  for (const key of SUB_MAP) {
    const map = schema[key]
    if (!object(map)) continue
    for (const value of Object.values(map)) if (typeUnions(value, root, depth + 1)) changed = true
  }
  return changed
}

/** The parts of a chat body this module touches. */
export interface ToolBody {
  tools?: unknown
  messages?: unknown
  tool_choice?: unknown
}

/**
 * Mend a chat body's function tools in place: their parameters and their names.
 * Returns whether it changed anything, and the names it gave (each to the name
 * the client knows), so the model's calls can be named back. A call in the
 * chat's history is named as its tool now is.
 */
export function fitTools(body: ToolBody): { changed: boolean; names: Map<string, string> } {
  const names = new Map<string, string>()
  const tools: unknown[] = Array.isArray(body.tools) ? body.tools : []
  if (!tools.length) return { changed: false, names }
  let changed = false
  const taken = new Set<string>()
  for (const tool of tools) {
    const name = object(tool) && object(tool.function) ? tool.function.name : undefined
    if (typeof name === 'string' && NAME_OK.test(name)) taken.add(name)
  }
  const theirs = new Map<string, string>()
  for (const tool of tools) {
    const fn = object(tool) && (tool.type === 'function' || tool.function) && object(tool.function)
      ? tool.function : undefined
    if (!fn) continue
    if (typeof fn.name === 'string' && !NAME_OK.test(fn.name)) {
      const safe = safeName(fn.name, taken)
      names.set(safe, fn.name)
      theirs.set(fn.name, safe)
      fn.name = safe
      changed = true
    }
    if (fn.parameters === undefined) continue
    if (!object(fn.parameters)) {
      fn.parameters = { type: 'object', properties: {} }
      changed = true
      continue
    }
    if (fitSchema(fn.parameters)) changed = true
    if (fitShape(fn.parameters)) changed = true
    if (typeUnions(fn.parameters)) changed = true
    if (objectRoot(fn.parameters)) changed = true
  }
  if (theirs.size && Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (!object(message)) continue
      for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        const fn = object(call) && object(call.function) ? call.function : undefined
        const safe = fn && typeof fn.name === 'string' ? theirs.get(fn.name) : undefined
        if (safe) fn!.name = safe
      }
      if (message.role === 'tool' && typeof message.name === 'string' && theirs.has(message.name)) {
        message.name = theirs.get(message.name)
      }
    }
  }
  const choice = object(body.tool_choice) && object(body.tool_choice.function)
    ? body.tool_choice.function : undefined
  if (choice && typeof choice.name === 'string' && theirs.has(choice.name)) {
    choice.name = theirs.get(choice.name)
  }
  return { changed, names }
}
