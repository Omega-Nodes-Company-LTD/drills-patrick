/**
 * `server-only` exists to break a client build. Under vitest there is no
 * client build to break, and the real module throws on import, which would
 * make every server module untestable.
 */
export {}
