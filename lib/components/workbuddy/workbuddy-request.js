import { createHash, randomUUID } from 'node:crypto';
import { fitTools } from './tool-schema.js';
import { normalizeToolChoice, systemKey, withSystem } from './shaping.js';
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 32);
/**
 * Shape a chat for WorkBuddy's endpoint (see `shaping.ts` and `tool-schema.ts`)
 * and name the conversation the way WorkBuddy's own client does, so one user
 * send counts as one request however many steps it takes.
 */
export function workbuddyRequest(input, options) {
    const body = structuredClone(input);
    withSystem(body);
    const { names } = fitTools(body);
    normalizeToolChoice(body);
    for (const message of body.messages ?? []) {
        if (message.role === 'assistant') {
            for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
                const item = call && typeof call === 'object' ? call : undefined;
                if (item?.type !== 'function' || typeof item.id !== 'string')
                    continue;
                item.id = /^[a-f0-9]{32}$/.test(item.id) ? item.id : hash(item.id);
            }
        }
        else if (message.role === 'tool' && typeof message.tool_call_id === 'string') {
            message.tool_call_id = /^[a-f0-9]{32}$/.test(message.tool_call_id) ? message.tool_call_id : hash(message.tool_call_id);
        }
    }
    const userIndex = options.messages.findLastIndex(message => message.role === 'user');
    const conversation = options.sessionId || hash(JSON.stringify(options.messages.find(message => message.role === 'user') ?? 'one-shot'));
    const request = hash(conversation + JSON.stringify(userIndex < 0 ? options.messages : options.messages.slice(0, userIndex + 1)));
    const id = randomUUID().replaceAll('-', '');
    return {
        body: body,
        names,
        systemKey: systemKey(body),
        headers: {
            'X-Conversation-ID': conversation, 'X-Conversation-Request-ID': request,
            'X-Conversation-Message-ID': id, 'X-Request-ID': id,
        },
    };
}
//# sourceMappingURL=workbuddy-request.js.map