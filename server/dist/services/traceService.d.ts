interface PersistTraceInput {
    runId: string;
    fileName: string;
    payload: unknown;
}
export declare function persistTraceJson(input: PersistTraceInput): Promise<{
    filePath: string;
    fileName: string;
    sizeBytes: number;
}>;
export {};
