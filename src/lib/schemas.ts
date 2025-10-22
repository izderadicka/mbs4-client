import { z } from "zod/v4";
import { id } from "zod/v4/locales";

const SeriesInnerSchema = z.object({
    id: z.number().positive(),
    title: z.string().min(1),
});

const LanguageInnerSchema = z.object({
    code: z.string().min(1).max(3),
    name: z.string().min(1).max(63),
    id: z.number().positive(),
});

const GenresInnerSchema = z.array(z.object({
    id: z.number().positive(),
    name: z.string().min(1).max(63),
})).max(2);

const GenresSchema = z.any().transform((val, ctx) => {
    const r = GenresInnerSchema.safeParse(val);
    if (!r.success) {
        if (r.error?.issues && r.error.issues.findIndex((i) => i.code === "too_big") !== -1) {
            ctx.addIssue({ code: "custom", message: "Too many genres.", path: [] });
        } else {
            ctx.addIssue({ code: "custom", message: "Genres are invalid.", path: [] });
        }
        return z.NEVER; // stops here; no field-level issues from inner schema
    }
    return r.data;
});

const LanguageSchema = z.any().transform((val, ctx) => {
    const r = LanguageInnerSchema.safeParse(val);
    if (!r.success) {
        // console.log("Language result", r);
        ctx.addIssue({ code: "custom", message: "Language is required.", path: [] });
        return z.NEVER; // stops here; no field-level issues from inner schema
    }
    return r.data;
});

const SeriesShortSchema = z.any().transform((val, ctx) => {
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
    description: z.nullish(z.string().max(1000)),
    // authors: z.array(z.object({
    //     id: z.nullable(z.bigint().positive()),
    //     first_name: z.nullable(z.string()),
    //     last_name: z.string(),
    // })),
    genres: z.nullable(GenresSchema),
    language: LanguageSchema,
    series: z.nullable(SeriesShortSchema),
    series_index: z.nullable(z.coerce.number().min(0)),
    // cover_file: z.nullable(z.string()),
    // version: z.nullable(z.bigint().positive()),

});

export const SeriesSchema = z.object({
    id: z.optional(z.number().positive()),
    version: z.optional(z.number().positive()),
    title: z.string().min(1).max(255),
    description: z.nullish(z.string().max(1000)),
    created_by: z.nullish(z.string()),
})
