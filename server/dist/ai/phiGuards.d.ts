import { type AiTaskType, type PhiPatternCount } from "./types.js";
export declare const FORBIDDEN_PHI_KEYS: readonly ["patientName", "firstName", "lastName", "dob", "dateOfBirth", "mrn", "medicalRecordNumber", "ssn", "phone", "email", "address", "street", "zip", "city", "state", "insuranceMemberId", "insuranceId", "guarantor"];
export declare const EMAIL_PATTERN: RegExp;
export declare const PHONE_PATTERN: RegExp;
export declare const SSN_PATTERN: RegExp;
export declare function normalizeKey(value: string): string;
export declare function isForbiddenPhiKey(key: string): boolean;
export declare function containsForbiddenPhiKeys(obj: unknown): {
    found: string[];
};
export declare function detectPhiLikePatterns(obj: unknown): {
    matches: PhiPatternCount[];
};
export declare function assertNoPhiPayload(payload: unknown, taskType?: AiTaskType): void;
