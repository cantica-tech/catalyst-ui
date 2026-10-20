/**
 * `T` as an older catalyst may give it: the fields `K`, added to catalyst's output since the reader's
 * kernel floor, may be absent. Every other field, and any index signature, stays as `T` has it.
 */
export type Since<T, K extends keyof T> = { [P in keyof T as P extends K ? never : P]: T[P] } & {
  [P in K]?: T[P];
};
