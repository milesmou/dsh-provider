import z from '@deepseek-ai/schemastery';
import { Config as WorkBuddyConfig } from './components/workbuddy/config.js';
import { Config as CodexConfig } from './components/codex/config.js';
export const Config = z.object({ workbuddy: WorkBuddyConfig, codex: CodexConfig });
//# sourceMappingURL=config.js.map