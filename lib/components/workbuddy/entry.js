import * as workbuddy from './index.js';
// Keep the original entry id and namespaced settings so existing accounts and
// model preferences survive the move to a separately managed Loader component.
export { Config } from '../../config.js';
export const name = 'codebuddy';
export const inject = workbuddy.inject;
export function apply(ctx, config) {
    workbuddy.apply(ctx, config.workbuddy);
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    });
}
//# sourceMappingURL=entry.js.map