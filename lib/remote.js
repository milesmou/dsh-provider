import { REMOTE as workbuddy } from './components/workbuddy/remote.js';
/** One package manifest assembles the Remotes contributed by its components. */
export const TYPERT = {
    package: 'dsh-provider', face: 'host', schemas: [],
    get invocations() { return workbuddy.descriptors; },
    model: { services: [], events: [], objects: [] },
};
//# sourceMappingURL=remote.js.map