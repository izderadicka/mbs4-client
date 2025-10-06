import { z } from "zod/v4";


export const ebookSchema = z.object({
    // id: z.nullable(z.bigint().positive()),
    title: z.string().min(1).max(255),
    description: z.nullable(z.string().max(1000)),
    // authors: z.array(z.object({
    //     id: z.nullable(z.bigint().positive()),
    //     first_name: z.nullable(z.string()),
    //     last_name: z.string(),
    // })),
    // genres: z.array(z.string()),
    // language: z.nullable(z.string()),
    // series: z.nullable(z.object({
    //     id: z.bigint().positive(),
    //     title: z.string(),

    // })),
    // series_index: z.nullable(z.int().min(0)),
    // cover_file: z.nullable(z.string()),
    // version: z.nullable(z.bigint().positive()),

});

export type EbookSchema = typeof ebookSchema;
// export type Ebook = z.infer<EbookSchema>;
