import { LlmError, textOnlyImageText } from '@deepseek-ai/dsh-llm';
import { object } from './session.js';
/** Function names must fit Responses constraints, including DSH's namespaced tools. */
export function toolNames(options) {
    const names = new Set((options.tools ?? []).map(tool => tool.name));
    for (const message of options.messages)
        for (const block of message.content)
            if (block.type === 'tool-call')
                names.add(block.name);
    const toWire = new Map();
    const fromWire = new Map();
    // Reserve already-valid names before allocating replacements to avoid collisions with history.
    for (const name of [...names].sort()) {
        if (/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
            toWire.set(name, name);
            fromWire.set(name, name);
        }
    }
    for (const name of [...names].sort()) {
        if (toWire.has(name))
            continue;
        const base = name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 56) || 'tool';
        let wire = base;
        for (let index = 2; fromWire.has(wire); index++)
            wire = `${base}_${index}`;
        toWire.set(name, wire);
        fromWire.set(wire, name);
    }
    return { toWire, fromWire };
}
function contentOf(content, images) {
    return content.map(block => {
        if (block.type === 'text')
            return { type: 'input_text', text: block.text };
        if (block.type === 'image') {
            const url = !block.offloaded && images.get(String(block.attachment.attachmentId));
            return url ? { type: 'input_image', image_url: url, detail: 'auto' } : { type: 'input_text', text: textOnlyImageText(block.attachment) };
        }
        throw new LlmError(`Codex: 不支持输入内容 ${block.type}。`, 'UNSUPPORTED_CONTENT');
    });
}
export function toInput(options, names, images = new Map()) {
    const input = [];
    for (const message of options.messages) {
        if (message.role === 'assistant') {
            const replay = message.source?.provider === options.provider && message.source.model === options.model
                ? object(message.source.replayState) : {};
            const metadata = object(replay.response).format === 'codex-responses-v1' && Array.isArray(replay.blocks) ? replay.blocks : [];
            for (const [index, block] of message.content.entries()) {
                if (block.type === 'reasoning') {
                    const item = object(object(metadata[index]).reasoning);
                    if (item.type === 'reasoning' && typeof item.encrypted_content === 'string')
                        input.push(item);
                }
                else if (block.type === 'tool-call') {
                    input.push({ type: 'function_call', call_id: block.id, name: names.toWire.get(block.name) ?? block.name, arguments: block.arguments });
                }
                else if (block.type === 'text') {
                    input.push({ role: 'assistant', content: [{ type: 'output_text', text: block.text }] });
                }
                else
                    throw new LlmError(`Codex: 不支持助手内容 ${block.type}。`, 'UNSUPPORTED_CONTENT');
            }
        }
        else if (message.role === 'tool') {
            input.push({ type: 'function_call_output', call_id: message.toolCallId, output: contentOf(message.content, images) });
        }
        else {
            const content = message.content.filter(block => block.type !== 'tool-addition' && block.type !== 'tool-removal');
            if (content.length)
                input.push({ role: message.role === 'system' ? 'developer' : message.role, content: contentOf(content, images) });
        }
    }
    return input;
}
//# sourceMappingURL=messages.js.map