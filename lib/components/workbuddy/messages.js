import { LlmError } from '@deepseek-ai/dsh-llm';
function textOf(content) {
    return content.map(block => {
        if (block.type === 'text')
            return block.text;
        // The Harness projects files to text before reaching a model adapter.
        // Refuse unsupported blocks instead of silently dropping user input.
        throw new LlmError(`CodeBuddy: unsupported input block ${block.type}; this version accepts text.`, 'UNSUPPORTED_CONTENT');
    }).join('');
}
export function toMessages(options) {
    const messages = [];
    if (options.system)
        messages.push({ role: 'system', content: options.system });
    for (const message of options.messages) {
        if (message.role === 'assistant') {
            const text = [];
            const reasoning = [];
            const calls = [];
            for (const block of message.content) {
                if (block.type === 'text')
                    text.push(block.text);
                else if (block.type === 'reasoning')
                    reasoning.push(block.text);
                else if (block.type === 'tool-call')
                    calls.push({
                        id: block.id, type: 'function', function: { name: block.name, arguments: block.arguments },
                    });
                else
                    throw new LlmError(`CodeBuddy: unsupported assistant block ${block.type}.`, 'UNSUPPORTED_CONTENT');
            }
            const item = {
                role: 'assistant', content: text.join('') || null,
                ...(calls.length ? { tool_calls: calls } : {}),
            };
            // CodeBuddy's reasoning models may require this when replaying tool turns.
            if (reasoning.length)
                item.reasoning_content = reasoning.join('');
            messages.push(item);
        }
        else if (message.role === 'tool') {
            messages.push({ role: 'tool', tool_call_id: message.toolCallId, content: textOf(message.content) });
        }
        else if (message.role === 'developer') {
            // This adapter declares no incremental tool-update capability. The
            // Harness sends complete current tool schemas in options.tools, so the
            // notices about them carry nothing the model needs.
            const text = message.content.filter(block => block.type !== 'tool-addition' && block.type !== 'tool-removal');
            // WorkBuddy takes `system`; it has no `developer` role.
            if (text.length)
                messages.push({ role: 'system', content: textOf(text) });
        }
        else {
            messages.push({ role: message.role, content: textOf(message.content) });
        }
    }
    return messages;
}
//# sourceMappingURL=messages.js.map