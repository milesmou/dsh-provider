import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import {
  BlockAssembler, ToolCallId, createAssistantMessage, createToolResultMessage,
} from '@deepseek-ai/dsh-llm'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config } from '../../../lib/components/workbuddy/config.js'
import { workbuddyRequest } from '../../../lib/components/workbuddy/workbuddy-request.js'

const DEFAULT_SYSTEM = 'You are a helpful assistant.'
const chunk = (delta, finish_reason = null) => ({ id: 'chat-1', object: 'chat.completion.chunk', created: 1,
  model: 'auto', choices: [{ index: 0, delta, finish_reason }] })
const sse = (...chunks) => chunks.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n'
const request = (values = {}) => ({ provider: 'workbuddy', model: 'auto',
  messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }], ...values })
const prepared = (values = {}) => workbuddyRequest({ model: 'auto', stream: true, messages: [], ...values }, { messages: [] })

function bodyOf(messages, extra = {}) {
  return prepared({ messages, ...extra }).body
}

async function fixture(t, handler) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return new CodeBuddyAdapter(Config({}), {
    baseURL: `http://127.0.0.1:${server.address().port}/v2`, workbuddy: true, providerName: 'WorkBuddy',
    authenticate: async () => ({ apiKey: 'oauth-secret',
      headers: { Authorization: 'Bearer oauth-secret', 'X-User-Id': 'user' } }),
  })
}

async function readBody(stream) {
  let text = ''
  for await (const part of stream) text += part
  return JSON.parse(text)
}

async function collect(adapter, values = {}) {
  const assembler = new BlockAssembler()
  for await (const value of adapter.stream(request(values))) assembler.push(value)
  return assembler
}

test('DSH identity lines are reworded, developer becomes system, and reasoning replays as reasoning', () => {
  const body = bodyOf([
    { role: 'system', content: 'You are an AI agent powered by DeepSeek Harness. Read https://example.test.' },
    { role: 'developer', content: 'tool notice' },
    { role: 'assistant', content: null, reasoning_content: 'thinking', tool_calls: [] },
    { role: 'user', content: 'You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names. When the user refers to "this page", they mean this GUI.' },
  ])
  assert.equal(body.messages[0].content, 'You are an AI agent that helps the user with programming tasks. Read https://example.test.')
  assert.equal(body.messages[1].role, 'system')
  assert.equal(body.messages[2].reasoning, 'thinking')
  assert.equal(body.messages[2].reasoning_content, undefined)
  assert.ok(!body.messages[0].content.includes('DeepSeek Harness'))
  assert.equal(body.messages[3].content,
    'You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names. The interface, when the user refers to "this page", they mean this GUI.')
})

test('a Claude Code billing header is dropped and a chat without a system message gets the default one', () => {
  const body = bodyOf([{ role: 'system', content: 'x-anthropic-billing-header: cch=abc\nreal words' }])
  assert.equal(body.messages[0].role, 'system')
  assert.equal(body.messages[0].content, 'real words')
  assert.equal(bodyOf([{ role: 'user', content: 'hi' }]).messages[0].content, DEFAULT_SYSTEM)
  const header = bodyOf([{ role: 'system', content: [{ type: 'text', text: 'x-anthropic-billing-header: cch=abc\n' }] },
    { role: 'user', content: 'hi' }])
  assert.equal(header.messages[0].content, DEFAULT_SYSTEM)
})

test('max_completion_tokens and the object tool_choice become the spellings WorkBuddy takes', () => {
  const body = bodyOf([{ role: 'user', content: 'hi' }], {
    max_completion_tokens: 256,
    tools: [{ type: 'function', function: { name: 'fs.read:file', parameters: { type: 'object' } } }],
    tool_choice: { type: 'function', function: { name: 'fs.read:file' } },
  })
  assert.equal(body.max_tokens, 256)
  assert.equal(body.max_completion_tokens, undefined)
  assert.equal(body.tool_choice, 'fs_read_file')
  assert.equal(body.tools[0].function.name, 'fs_read_file')
  const none = bodyOf([{ role: 'user', content: 'hi' }], {
    tools: [{ type: 'function', function: { name: 'read', parameters: { type: 'object' } } }],
    tool_choice: { type: 'none' },
  })
  assert.equal(none.tool_choice, undefined)
  assert.equal(none.tools, undefined)
})

test('tool schemas are mended: enums, boolean subschemas, NUL patterns, tuples and unknown types', () => {
  const body = bodyOf([{ role: 'user', content: 'hi' }], {
    tools: [{ type: 'function', function: { name: 'read', parameters: {
      type: 'Object',
      properties: {
        mode: { enum: ['a', 'b'] },
        mixed: { enum: [1, 'a', null] },
        empty: { enum: [] },
        anything: true,
        nothing: false,
        pattern: { type: 'string', pattern: '^a\\0b$' },
        escaped: { type: 'string', pattern: '^a\\\\0b$' },
        tuple: { type: 'array', items: [{ type: 'string' }, { type: 'number' }], additionalItems: false },
        odd: { type: ['string', 'wat'] },
      },
      required: 'nope',
      additionalProperties: false,
    } } }],
  })
  const parameters = body.tools[0].function.parameters
  assert.equal(parameters.type, 'object')
  assert.deepEqual(parameters.properties.mode, { enum: ['a', 'b'], type: 'string' })
  assert.equal(parameters.properties.empty.enum, undefined)
  assert.deepEqual(parameters.properties.anything, {})
  assert.deepEqual(parameters.properties.nothing, { not: {} })
  assert.equal(parameters.properties.pattern.pattern, '^a\\u0000b$')
  assert.equal(parameters.properties.escaped.pattern, '^a\\\\0b$')
  assert.deepEqual(parameters.properties.tuple.items, { anyOf: [{ type: 'string' }, { type: 'number' }] })
  assert.equal(parameters.properties.tuple.additionalItems, undefined)
  assert.equal(parameters.properties.odd.type, 'string')
  assert.equal(parameters.required, undefined)
  assert.equal(parameters.additionalProperties, false)
  assert.deepEqual(parameters.properties.mixed.anyOf,
    [{ type: 'integer', enum: [1] }, { type: 'string', enum: ['a'] }, { type: 'null' }])
})

test('a root union becomes one object and a typeless oneOf of objects gets its type', () => {
  const body = bodyOf([{ role: 'user', content: 'hi' }], {
    tools: [
      { type: 'function', function: { name: 'union', parameters: {
        anyOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } }, required: ['a'] },
        ],
      } } },
      { type: 'function', function: { name: 'refs', parameters: {
        $defs: { one: { type: 'object', properties: { x: { type: 'string' } } }, two: { type: 'object', properties: { y: { type: 'string' } } } },
        properties: { choice: { oneOf: [{ $ref: '#/$defs/one' }, { $ref: '#/$defs/two' }] } },
      } } },
    ],
  })
  const union = body.tools[0].function.parameters
  assert.equal(union.type, 'object')
  assert.equal(union.anyOf, undefined)
  assert.deepEqual(Object.keys(union.properties).sort(), ['a', 'b'])
  assert.deepEqual(union.required, ['a'])
  assert.equal(body.tools[1].function.parameters.properties.choice.type, 'object')
})

test('tool names WorkBuddy refuses are made safe, renamed in history, and mapped back on the wire', async t => {
  const bodies = []
  const adapter = await fixture(t, async (req, res) => {
    bodies.push(await readBody(req))
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(chunk({ tool_calls: [{ index: 0, id: 'a'.repeat(32),
      function: { name: bodies.at(-1).tools[0].function.name, arguments: '{}' } }] }, 'tool_calls')))
  })
  const assembler = await collect(adapter, {
    tools: [{ name: 'fs.read:file', description: 'read', parameters: { type: 'object' } }],
  })
  assert.equal(bodies[0].tools[0].function.name, 'fs_read_file')
  assert.equal(assembler.blocks()[0].name, 'fs.read:file')

  const history = bodyOf([], {
    tools: [{ type: 'function', function: { name: 'fs.read:file', parameters: { type: 'object' } } }],
    messages: [
      { role: 'assistant', content: null, tool_calls: [{ id: 'dsh-call-id', type: 'function',
        function: { name: 'fs.read:file', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'dsh-call-id', content: 'ok' },
    ],
  })
  assert.equal(history.messages[0].content, DEFAULT_SYSTEM)
  assert.equal(history.messages[1].tool_calls[0].function.name, 'fs_read_file')
  assert.equal(history.messages[1].tool_calls[0].id, history.messages[2].tool_call_id)
  assert.match(history.messages[2].tool_call_id, /^[0-9a-f]{32}$/)
})

test('chat headers carry the CLI fingerprint beside the sign-in headers', async t => {
  let headers
  const adapter = await fixture(t, async (req, res) => {
    headers = req.headers
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(chunk({ content: 'ok' }, 'stop')))
  })
  await collect(adapter)
  assert.equal(headers.authorization, 'Bearer oauth-secret')
  assert.equal(headers['x-user-id'], 'user')
  assert.equal(headers['x-stainless-package-version'], '6.25.0')
  assert.equal(headers['x-stainless-retry-count'], '0')
  assert.equal(headers['x-stainless-timeout'], '1200')
  assert.equal(headers['x-stainless-runtime-version'], 'v22.21.1')
  assert.match(headers['x-conversation-id'], /^[0-9a-f]{32}$/)
  assert.match(headers['x-conversation-request-id'], /^[0-9a-f]{32}$/)
})

test('11128 moves the system prompt into the user message once, then remembers it', async t => {
  const bodies = []
  let calls = 0
  const adapter = await fixture(t, async (req, res) => {
    calls++
    bodies.push(await readBody(req))
    if (calls === 1) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ code: 11128, msg: 'Illegal API invocation from an unapproved channel' }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(chunk({ content: 'ok' }, 'stop')))
  })
  const assembler = await collect(adapter, { system: 'You are a coding agent.' })
  assert.deepEqual(assembler.blocks(), [{ type: 'text', text: 'ok' }])
  assert.equal(calls, 2)
  assert.equal(bodies[0].messages[0].content, 'You are a coding agent.')
  assert.equal(bodies[1].messages[0].content, DEFAULT_SYSTEM)
  assert.equal(bodies[1].messages[1].content,
    '<instructions>\nYou are a coding agent.\n</instructions>\n\n你好')
  // The same prompt is known to be refused, so the next chat goes moved at once.
  await collect(adapter, { system: 'You are a coding agent.' })
  assert.equal(calls, 3)
  assert.equal(bodies[2].messages[0].content, DEFAULT_SYSTEM)
  assert.match(bodies[2].messages[1].content, /^<instructions>\nYou are a coding agent\./)
})

test('11153 puts an empty assistant message between tool results and the user, once per model', async t => {
  const bodies = []
  let calls = 0
  const adapter = await fixture(t, async (req, res) => {
    calls++
    bodies.push(await readBody(req))
    if (calls === 1) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ code: 11153, msg: 'the conversation must end with a user message' }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(chunk({ content: 'ok' }, 'stop')))
  })
  const assistant = createAssistantMessage({ source: { provider: 'workbuddy', model: 'auto' },
    content: [{ type: 'tool-call', id: ToolCallId('call_a'), name: 'read', arguments: '{}' }] })
  const tool = createToolResultMessage({ callId: ToolCallId('call_a'), content: [{ type: 'text', text: 'result' }], isError: false })
  const messages = [assistant, tool, { role: 'user', content: [{ type: 'text', text: '又见' }] }]
  await collect(adapter, { messages })
  assert.equal(calls, 2)
  const reply = bodies[1].messages.at(-2)
  assert.equal(reply.role, 'assistant')
  assert.equal(reply.content, '')
  assert.equal(bodies[1].messages.at(-1).role, 'user')
  await collect(adapter, { messages })
  assert.equal(calls, 3)
  assert.equal(bodies[2].messages.at(-2).role, 'assistant')
})

test('a refused chat with no system prompt is not resent', async t => {
  let calls = 0
  const adapter = await fixture(t, async (_req, res) => {
    calls++
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ code: 11128, msg: 'Illegal API invocation from an unapproved channel' }))
  })
  await assert.rejects(() => collect(adapter), { code: 'CHANNEL_RESTRICTED' })
  assert.equal(calls, 1)
})
