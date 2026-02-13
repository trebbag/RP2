export interface TranscriptQualitySegment {
    id?: string;
    speaker: string;
    speakerLabel?: string | null;
    text: string;
    confidence?: number | null;
    startMs: number;
    endMs: number;
}
export interface TranscriptQualityReport {
    score: number;
    needsReview: boolean;
    metrics: {
        segmentCount: number;
        lowConfidenceCount: number;
        unknownSpeakerCount: number;
        veryShortSegmentCount: number;
        avgConfidence: number;
        speakerSwitchRate: number;
    };
    issues: Array<{
        code: "LOW_CONFIDENCE" | "UNKNOWN_SPEAKER" | "VERY_SHORT_SEGMENT" | "CHATTER_SWITCHING";
        severity: "critical" | "warning" | "info";
        message: string;
        segmentId?: string;
    }>;
    recommendedActions: string[];
}
export declare function buildTranscriptQualityReport(segments: TranscriptQualitySegment[]): TranscriptQualityReport;
