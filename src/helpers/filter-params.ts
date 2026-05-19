
export type FilterParams<T> = { [P in keyof T]?: T[P] | undefined } & { property_id?: string | undefined }
