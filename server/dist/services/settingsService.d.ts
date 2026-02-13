import { z } from "zod";
export declare const userSettingsSchema: z.ZodObject<{
    suggestions: z.ZodObject<{
        codes: z.ZodBoolean;
        compliance: z.ZodBoolean;
        publicHealth: z.ZodBoolean;
        differentials: z.ZodBoolean;
        followUp: z.ZodBoolean;
    }, z.core.$strip>;
    appearance: z.ZodObject<{
        theme: z.ZodEnum<{
            modern: "modern";
            classic: "classic";
            compact: "compact";
            accessible: "accessible";
        }>;
        colorMode: z.ZodEnum<{
            system: "system";
            light: "light";
            dark: "dark";
        }>;
    }, z.core.$strip>;
    clinical: z.ZodObject<{
        specialty: z.ZodString;
        payer: z.ZodString;
        region: z.ZodString;
        guidelines: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    language: z.ZodObject<{
        interfaceLanguage: z.ZodString;
        summaryLanguage: z.ZodString;
    }, z.core.$strip>;
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            "Follow-up": "Follow-up";
            SOAP: "SOAP";
            Wellness: "Wellness";
            Custom: "Custom";
        }>;
        content: z.ZodString;
        lastModified: z.ZodString;
    }, z.core.$strip>>;
    clinicalRules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        condition: z.ZodString;
        action: z.ZodString;
        enabled: z.ZodBoolean;
    }, z.core.$strip>>;
    advanced: z.ZodObject<{
        promptOverrides: z.ZodString;
        isOfflineMode: z.ZodBoolean;
        localModelsDownloaded: z.ZodBoolean;
    }, z.core.$strip>;
    mfa: z.ZodObject<{
        preferredMethod: z.ZodDefault<z.ZodEnum<{
            totp: "totp";
            backup: "backup";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type UserSettingsPayload = z.infer<typeof userSettingsSchema>;
export declare const defaultUserSettings: UserSettingsPayload;
export declare function normalizeUserSettingsPayload(payload: unknown): UserSettingsPayload;
