import * as workbuddy from './components/workbuddy/index.js';
export { Config } from './config.js';
export const name = 'dsh-provider';
export const inject = ['llm'];
/** Components own their routes and lifecycle; the root owns their configuration. */
export function apply(ctx, config) {
    ctx.plugin({
        name: 'dsh-provider-workbuddy', inject: workbuddy.inject,
        apply: child => workbuddy.apply(child, config.workbuddy),
    });
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    });
}
//# sourceMappingURL=index.js.map