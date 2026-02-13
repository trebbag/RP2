import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonFile } from "../utils/fs.js";
function safeNumber(value) {
    if (!value)
        return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function normalizeListValue(value) {
    return value
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
function sectionList(lines, labels) {
    const collected = [];
    const normalizedLabels = labels.map((label) => label.toLowerCase());
    for (const line of lines) {
        const lowered = line.toLowerCase();
        const hit = normalizedLabels.find((label) => lowered.startsWith(`${label}:`) || lowered.startsWith(`${label} -`));
        if (!hit)
            continue;
        const value = line.slice(hit.length + 1).trim().replace(/^[-:]\s*/, "");
        collected.push(...normalizeListValue(value));
    }
    return Array.from(new Set(collected));
}
function parseLabs(lines) {
    const labs = [];
    const labPattern = /^\s*(?:lab|labs?)\s*[:\-]\s*([a-zA-Z0-9 .()%/-]+?)\s*[:=]\s*([a-zA-Z0-9.%/-]+)\s*([a-zA-Z/%]+)?\s*(H|L|high|low)?\s*$/i;
    for (const line of lines) {
        const match = line.match(labPattern);
        if (!match)
            continue;
        labs.push({
            name: match[1]?.trim() ?? "Lab",
            value: match[2]?.trim() ?? "",
            unit: match[3]?.trim() || undefined,
            flag: match[4]?.trim() || undefined
        });
    }
    return labs;
}
function parseVitals(text) {
    const bp = text.match(/\b(?:BP|Blood Pressure)\s*[:=]?\s*(\d{2,3})\s*[\/\\]\s*(\d{2,3})/i);
    const hr = text.match(/\b(?:HR|Heart Rate|Pulse)\s*[:=]?\s*(\d{2,3})\b/i);
    const tempF = text.match(/\b(?:Temp|Temperature)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*F\b/i);
    const tempC = text.match(/\b(?:Temp|Temperature)\s*[:=]?\s*(\d{2}(?:\.\d+)?)\s*°?\s*C\b/i);
    const resp = text.match(/\b(?:RR|Respiratory Rate)\s*[:=]?\s*(\d{1,2})\b/i);
    const spo2 = text.match(/\b(?:SpO2|O2 Sat|Oxygen Saturation)\s*[:=]?\s*(\d{2,3})\s*%/i);
    const tempValueF = safeNumber(tempF?.[1]) ?? (safeNumber(tempC?.[1]) ? (safeNumber(tempC?.[1]) * 9) / 5 + 32 : undefined);
    return {
        bpSystolic: safeNumber(bp?.[1]),
        bpDiastolic: safeNumber(bp?.[2]),
        hrBpm: safeNumber(hr?.[1]),
        tempF: tempValueF ? Number(tempValueF.toFixed(1)) : undefined,
        respiratoryRate: safeNumber(resp?.[1]),
        spo2Pct: safeNumber(spo2?.[1])
    };
}
function readJsonTextIfPossible(rawText) {
    try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
function valuesToLines(value) {
    if (value == null)
        return [];
    if (Array.isArray(value)) {
        return value.flatMap((entry) => valuesToLines(entry));
    }
    if (typeof value === "object") {
        return Object.entries(value).flatMap(([key, nested]) => {
            if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
                return [`${key}: ${String(nested)}`];
            }
            return valuesToLines(nested);
        });
    }
    return [String(value)];
}
function isTextLikeMimeType(mimeType) {
    if (mimeType.startsWith("text/"))
        return true;
    return [
        "application/json",
        "application/xml",
        "text/csv",
        "application/csv",
        "text/plain"
    ].includes(mimeType);
}
async function readChartText(filePath, mimeType) {
    if (isTextLikeMimeType(mimeType)) {
        return fs.readFile(filePath, "utf8");
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".json") {
        return fs.readFile(filePath, "utf8");
    }
    return null;
}
export async function extractStructuredChart(input) {
    const extractedAt = new Date().toISOString();
    const rawText = await readChartText(input.filePath, input.mimeType);
    const safeText = rawText ?? "";
    const parsedJson = rawText ? readJsonTextIfPossible(rawText) : null;
    const textLines = safeText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const jsonLines = parsedJson ? valuesToLines(parsedJson) : [];
    const lines = [...textLines, ...jsonLines];
    const medications = sectionList(lines, ["medications", "meds", "current meds"]);
    const allergies = sectionList(lines, ["allergies", "allergy"]);
    const pastMedicalHistory = sectionList(lines, ["pmh", "past medical history", "history"]);
    const problems = sectionList(lines, ["problem list", "problems", "diagnoses"]);
    const labs = parseLabs(lines);
    const vitals = parseVitals(safeText || lines.join("\n"));
    const narrativeSnippets = lines.slice(0, 20);
    const extractedJson = {
        extractedAt,
        sourceFile: input.fileName,
        sourceMimeType: input.mimeType,
        patientId: input.patientId,
        encounterId: input.encounterId,
        vitals,
        medications,
        allergies,
        pastMedicalHistory,
        labs,
        problems,
        narrativeSnippets
    };
    return {
        rawText,
        extractedJson
    };
}
export async function persistStructuredChart(filePath, extractedJson) {
    await writeJsonFile(filePath, extractedJson);
    const stats = await fs.stat(filePath);
    return Number(stats.size);
}
//# sourceMappingURL=chartExtractionService.js.map