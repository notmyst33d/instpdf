import z from "zod";

export const DocumentMime = z.enum(['image/jpeg', 'image/png', 'application/pdf']);
export type DocumentMime = z.infer<typeof DocumentMime>;

export const DocumentFilter = z.enum(['none', 'single', 'from']);
export type DocumentFilter = z.infer<typeof DocumentFilter>;

export const Document = z.object({
    mime: DocumentMime,
    data: z.instanceof(Uint8Array),
    filter: z.object({
        type: DocumentFilter,
        page: z.int().nullable().optional(),
    }),
});
export type Document = z.infer<typeof Document>;
