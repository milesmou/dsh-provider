import { REMOTE as workbuddy } from './components/workbuddy/remote.js';
import { REMOTE as codex } from './components/codex/remote.js';
/** DSH permits one Remote contribution per package, shared by both UI components. */
export const REMOTE = {
    package: 'dsh-provider',
    get descriptors() { return [...workbuddy.descriptors, ...codex.descriptors]; },
};
/** One package manifest assembles the Remotes contributed by its components. */
export const TYPERT = {
    package: 'dsh-provider', face: 'host', schemas: [],
    get invocations() { return REMOTE.descriptors; },
    model: { services: [], events: [], objects: [] },
};
//# sourceMappingURL=remote.js.map