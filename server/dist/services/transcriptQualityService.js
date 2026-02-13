import { env } from "../config/env.js";
const LOW_CONFIDENCE_THRESHOLD = 0.72;
const VERY_SHORT_TEXT_THRESHOLD = 4;
function normalizeSpeaker(value) {
    return value.trim().toLowerCase();
}
function getAllowedSpeakers() {
    const configured = env.DIARIZATION_SPEAKERS.split(",")
        .map((speaker) => normalizeSpeaker(speaker))
        .filter(Boolean);
    const fallback = ["doctor", "patient"];
    return new Set(configured.length > 0 ? configured : fallback);
}
export function buildTranscriptQualityReport(segments) {
    const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
    const allowedSpeakers = getAllowedSpeakers();
    let lowConfidenceCount = 0;
    let unknownSpeakerCount = 0;
    let veryShortSegmentCount = 0;
    let switches = 0;
    let confidenceTotal = 0;
    let confidenceCount = 0;
    const issues = [];
    for (let index = 0; index < sorted.length; index += 1) {
        const segment = sorted[index];
        const normalizedSpeaker = normalizeSpeaker(segment.speaker);
        const normalizedText = segment.text.trim();
        if (typeof segment.confidence === "number") {
            confidenceTotal += segment.confidence;
            confidenceCount += 1;
            if (segment.confidence < LOW_CONFIDENCE_THRESHOLD) {
                lowConfidenceCount += 1;
                issues.push({
                    code: "LOW_CONFIDENCE",
                    severity: "warning",
                    message: `Segment confidence ${Math.round(segment.confidence * 100)}% is below threshold.`,
                    segmentId: segment.id
                });
            }
        }
        if (normalizedText.split(/\s+/).filter(Boolean).length <= VERY_SHORT_TEXT_THRESHOLD) {
            veryShortSegmentCount += 1;
            issues.push({
                code: "VERY_SHORT_SEGMENT",
                severity: "info",
                message: "Very short segment may indicate clipping or missed phrase.",
                segmentId: segment.id
            });
        }
        if (!allowedSpeakers.has(normalizedSpeaker)) {
            unknownSpeakerCount += 1;
            issues.push({
                code: "UNKNOWN_SPEAKER",
                severity: "warning",
                message: `Speaker "${segment.speaker}" is outside configured diarization labels.`,
                segmentId: segment.id
            });
        }
        if (index > 0 && normalizeSpeaker(sorted[index - 1].speaker) !== normalizedSpeaker) {
            switches += 1;
        }
    }
    const segmentCount = sorted.length;
    const avgConfidence = confidenceCount > 0 ? confidenceTotal / confidenceCount : 1;
    const speakerSwitchRate = segmentCount > 1 ? switches / (segmentCount - 1) : 0;
    const unstableSwitching = speakerSwitchRate > 0.85 && segmentCount > 6;
    if (unstableSwitching) {
        issues.push({
            code: "CHATTER_SWITCHING",
            severity: "warning",
            message: "Rapid speaker switching suggests diarization instability."
        });
    }
    const lowConfidencePenalty = Math.min(40, lowConfidenceCount * 6);
    const unknownSpeakerPenalty = Math.min(25, unknownSpeakerCount * 5);
    const shortSegmentPenalty = Math.min(20, veryShortSegmentCount * 2);
    const switchPenalty = speakerSwitchRate > 0.8 ? 12 : speakerSwitchRate > 0.65 ? 6 : 0;
    const score = Math.max(0, Math.round(100 - lowConfidencePenalty - unknownSpeakerPenalty - shortSegmentPenalty - switchPenalty));
    const needsReview = score < 78 || lowConfidenceCount >= 2 || unknownSpeakerCount >= 1 || unstableSwitching;
    const recommendedActions = [];
    if (lowConfidenceCount > 0) {
        recommendedActions.push("Review low-confidence lines and correct wording if clinically important.");
    }
    if (unknownSpeakerCount > 0) {
        recommendedActions.push("Reassign unknown speaker labels to the correct participant.");
    }
    if (unstableSwitching) {
        recommendedActions.push("Batch-correct nearby segments with unstable speaker alternation.");
    }
    if (recommendedActions.length === 0) {
        recommendedActions.push("Transcript quality is acceptable for normal workflow.");
    }
    return {
        score,
        needsReview,
        metrics: {
            segmentCount,
            lowConfidenceCount,
            unknownSpeakerCount,
            veryShortSegmentCount,
            avgConfidence: Number(avgConfidence.toFixed(3)),
            speakerSwitchRate: Number(speakerSwitchRate.toFixed(3))
        },
        issues,
        recommendedActions
    };
}
//# sourceMappingURL=transcriptQualityService.js.map