import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { ResponseInput } from 'openai/resources/responses/responses';
export interface ToolNames {
    toWire: Map<string, string>;
    fromWire: Map<string, string>;
}
/** Function names must fit Responses constraints, including DSH's namespaced tools. */
export declare function toolNames(options: GenerateOptions): ToolNames;
export declare function toInput(options: GenerateOptions, names: ToolNames, images?: ReadonlyMap<string, string>): ResponseInput;
