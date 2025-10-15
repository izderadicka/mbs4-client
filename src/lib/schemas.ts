import { z } from "zod/v4";

const SeriesInnerSchema = z.object({
    id: z.number().positive(),
    title: z.string().min(1),
});

const SeriesSchema = z.any().transform((val, ctx) => {
    const r = SeriesInnerSchema.safeParse(val);
    if (!r.success) {
        ctx.addIssue({ code: "custom", message: "Series is invalid.", path: [] });
        return z.NEVER; // stops here; no field-level issues from inner schema
    }
    return r.data;
});


export const EbookSchema = z.object({
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
    series: z.nullable(SeriesSchema),
    seriesIndex: z.nullable(z.number().min(0)),
    // cover_file: z.nullable(z.string()),
    // version: z.nullable(z.bigint().positive()),

});

export type EbookSchema = typeof EbookSchema;
// export type Ebook = z.infer<EbookSchema>;
