interface ChartExtractionInput {
    filePath: string;
    fileName: string;
    mimeType: string;
    patientId: string;
    encounterId?: string | null;
}
interface LabRecord {
    name: string;
    value: string;
    unit?: string;
    flag?: string;
}
interface StructuredChart {
    extractedAt: string;
    sourceFile: string;
    sourceMimeType: string;
    patientId: string;
    encounterId?: string | null;
    vitals: {
        bpSystolic?: number;
        bpDiastolic?: number;
        hrBpm?: number;
        tempF?: number;
        respiratoryRate?: number;
        spo2Pct?: number;
    };
    medications: string[];
    allergies: string[];
    pastMedicalHistory: string[];
    labs: LabRecord[];
    problems: string[];
    narrativeSnippets: string[];
}
export declare function extractStructuredChart(input: ChartExtractionInput): Promise<{
    rawText: string | null;
    extractedJson: StructuredChart;
}>;
export declare function persistStructuredChart(filePath: string, extractedJson: StructuredChart): Promise<number>;
export {};
