export interface TextRedactionSummary {
    emailCount: number;
    phoneCount: number;
    ssnCount: number;
    dateCount: number;
    total: number;
}
export interface EncounterRedactionSummary extends TextRedactionSummary {
    droppedKeyPaths: string[];
}
export interface EncounterDeidentifyInput {
    noteContent?: string;
    transcriptText?: string;
    chartContext?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    selectedCodes?: string[];
    speakerHint?: string;
    speakerHints?: string[];
}
export interface DeidentifiedEncounterContext {
    noteText: string;
    transcriptText: string;
    chartFacts: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    selectedCodes: string[];
    speakerHint?: string;
    speakerHints: string[];
    redactionSummary: EncounterRedactionSummary;
}
export declare function deidentifyText(text: string): {
    text: string;
    redactionSummary: TextRedactionSummary;
};
export declare function deidentifyEncounterContext(input: EncounterDeidentifyInput): DeidentifiedEncounterContext;
