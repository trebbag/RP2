interface PdfPayload {
    title: string;
    subtitle?: string;
    content: string;
}
export declare function createPdfArtifact(baseDir: string, fileName: string, payload: PdfPayload): Promise<{
    filePath: string;
    sizeBytes: number;
    mimeType: string;
}>;
export {};
