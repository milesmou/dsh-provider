/** DSH permits one Remote contribution per package, shared by both UI components. */
export declare const REMOTE: {
    package: string;
    readonly descriptors: import("@deepseek-ai/dsh-typert-protocol").InvocationDescriptor[];
};
/** One package manifest assembles the Remotes contributed by its components. */
export declare const TYPERT: {
    package: string;
    face: string;
    schemas: never[];
    readonly invocations: import("@deepseek-ai/dsh-typert-protocol").InvocationDescriptor[];
    model: {
        services: never[];
        events: never[];
        objects: never[];
    };
};
