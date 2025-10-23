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
})).max(10);

const AuthorsInnerSchema = z.array(z.object({
    id: z.number().positive(),
    first_name: z.nullable(z.string().min(1).max(63)),
    last_name: z.string().min(1).max(63),
})).max(20);

const AuthorsSchema = customValidate(AuthorsInnerSchema, {
    custom: "Authors are invalid.",
    too_big: "Too many authors.",
});

const GenresSchema = customValidate(GenresInnerSchema, {
    custom: "Genres are invalid.",
    too_big: "Too many genres.",
});

const LanguageSchema = customValidate(LanguageInnerSchema, {
    custom: "Language is required.",
});

const SeriesShortSchema = customValidate(SeriesInnerSchema, {
    custom: "Series is invalid.",
});


export const EbookSchema = z.object({
    // id: z.nullable(z.bigint().positive()),
    title: z.string().min(1).max(255),
    description: z.nullish(z.string().max(1000)),
    authors: z.nullable(AuthorsSchema),
    genres: z.nullable(GenresSchema),
    language: LanguageSchema,
    series: z.nullable(SeriesShortSchema),
    series_index: z.nullable(z.coerce.number().min(0)),
    // cover_file: z.nullable(z.string()),
    // version: z.nullable(z.bigint().positive()),

}).superRefine((data, ctx) => {
    if (data.series && data.series_index == null) {
        ctx.addIssue({ code: "custom", message: "Series index is required, if series is selected.", path: ["series_index"] });
    }
    if (data.series_index != null && data.series == null) {
        ctx.addIssue({ code: "custom", message: "Series is required, if series index is selected.", path: ["series"] });
    }
});

export const SeriesSchema = z.object({
    id: z.optional(z.number().positive()),
    version: z.optional(z.number().positive()),
    title: z.string().min(1).max(255),
    description: z.nullish(z.string().max(1000)),
    created_by: z.nullish(z.string()),
})


function customValidate(schema: z.ZodTypeAny, messages: { custom?: string, too_big?: string } = {}) {
    return z.any().transform((val, ctx) => {
        const r = schema.safeParse(val);
        if (!r.success) {
            console.debug("Custom validation error", r.error);
            const { custom = "Invalid value", too_big = "Too many items" } = messages;
            if (r.error?.issues && r.error.issues.findIndex((i) => i.code === "too_big") !== -1) {
                ctx.addIssue({ code: "custom", message: too_big, path: [] });
            } else {
                ctx.addIssue({ code: "custom", message: custom, path: [] });
            }
            return z.NEVER; // stops here; no field-level issues from inner schema
        }
        return r.data;
    });
}
