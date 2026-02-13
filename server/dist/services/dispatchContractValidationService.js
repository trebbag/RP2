import { z } from "zod";
import { buildDispatchContractForConfig } from "./ehrContractService.js";
const fhirBundleSchema = z.object({
    resourceType: z.literal("Bundle"),
    type: z.string(),
    entry: z.array(z.object({
        resource: z.object({
            resourceType: z.string()
        })
    }))
});
const vendorJsonBaseSchema = z.record(z.string(), z.unknown());
const dispatchPayloadSchema = z.object({
    encounterExternalId: z.string().min(1),
    patientExternalId: z.string().min(1),
    providerName: z.string().min(1),
    noteContent: z.string().min(1),
    patientSummary: z.string().min(1),
    billing: z.object({
        payerModel: z.string().min(1),
        selectedCptCodes: z.array(z.string()).default([]),
        estimatedChargeCents: z.number().int().nonnegative(),
        expectedReimbursementCents: z.number().int().nonnegative()
    }),
    artifacts: z.array(z.object({
        id: z.string(),
        type: z.string(),
        fileName: z.string()
    }))
});
export const defaultDispatchValidationPayload = {
    encounterExternalId: "ENC-VALIDATION-001",
    patientExternalId: "PAT-VALIDATION-001",
    providerName: "Dr. Validation",
    noteContent: "Assessment and plan for dispatch contract validation.",
    patientSummary: "Patient summary validation text.",
    billing: {
        payerModel: "MEDICARE",
        selectedCptCodes: ["99213"],
        estimatedChargeCents: 15300,
        expectedReimbursementCents: 12240
    },
    artifacts: [
        {
            id: "artifact-validation-note",
            type: "NOTE_PDF",
            fileName: "clinical-note.pdf"
        }
    ]
};
function validateHl7Contract(raw) {
    const errors = [];
    const lines = raw
        .split("\r")
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.some((line) => line.startsWith("MSH|")))
        errors.push("MSH segment missing");
    if (!lines.some((line) => line.startsWith("PID|")))
        errors.push("PID segment missing");
    if (!lines.some((line) => line.startsWith("OBR|")))
        errors.push("OBR segment missing");
    if (!lines.some((line) => line.startsWith("OBX|1|TX|NOTE^Final Clinical Note|"))) {
        errors.push("Primary note OBX segment missing");
    }
    return errors;
}
function validateVendorPayload(parsed, vendor) {
    const errors = [];
    if (vendor === "ATHENAHEALTH") {
        if (typeof parsed.sourceSystem !== "string")
            errors.push("ATHENAHEALTH payload requires sourceSystem");
        if (typeof parsed.athenaEncounterId !== "string")
            errors.push("ATHENAHEALTH payload requires athenaEncounterId");
    }
    else if (vendor === "NEXTGEN") {
        if (typeof parsed.msgType !== "string")
            errors.push("NEXTGEN payload requires msgType");
        if (typeof parsed.nextgen !== "object" || parsed.nextgen === null)
            errors.push("NEXTGEN payload requires nextgen object");
    }
    else if (vendor === "ECLINICALWORKS") {
        if (typeof parsed.apiVersion !== "string")
            errors.push("ECLINICALWORKS payload requires apiVersion");
        if (typeof parsed.action !== "string")
            errors.push("ECLINICALWORKS payload requires action");
    }
    else {
        if (typeof parsed.vendor !== "string" && typeof parsed.payload !== "object") {
            errors.push("Generic vendor payload requires vendor or payload fields");
        }
    }
    return errors;
}
export function validateDispatchContract(input) {
    const payload = dispatchPayloadSchema.parse(input.payload ?? defaultDispatchValidationPayload);
    const contract = buildDispatchContractForConfig(payload, {
        target: input.target,
        vendor: input.vendor
    });
    const errors = [];
    if (contract.contractType === "FHIR_BUNDLE_R4") {
        const parsed = fhirBundleSchema.safeParse(JSON.parse(contract.body));
        if (!parsed.success) {
            errors.push(...parsed.error.issues.map((issue) => issue.message));
        }
        else {
            const resourceTypes = parsed.data.entry.map((entry) => entry.resource.resourceType);
            if (!resourceTypes.includes("Composition"))
                errors.push("FHIR bundle missing Composition resource");
            if (!resourceTypes.includes("Claim"))
                errors.push("FHIR bundle missing Claim resource");
        }
    }
    else if (contract.contractType === "HL7_ORU_R01") {
        errors.push(...validateHl7Contract(contract.body));
    }
    else if (contract.contractType === "VENDOR_JSON") {
        const parsed = vendorJsonBaseSchema.safeParse(JSON.parse(contract.body));
        if (!parsed.success) {
            errors.push(...parsed.error.issues.map((issue) => issue.message));
        }
        else {
            errors.push(...validateVendorPayload(parsed.data, input.vendor));
        }
    }
    return {
        ok: errors.length === 0,
        contractType: contract.contractType,
        contentType: contract.contentType,
        errors
    };
}
export function dispatchSandboxReadiness(input) {
    const checks = [];
    if (input.target === "HL7_V2") {
        checks.push({
            key: "mllp",
            ok: input.mllpConfigured,
            detail: input.mllpConfigured ? "MLLP host/port configured" : "MLLP host/port missing"
        });
    }
    else if (input.target !== "NONE") {
        checks.push({
            key: "endpoint",
            ok: input.webhookConfigured,
            detail: input.webhookConfigured ? "Dispatch endpoint configured" : "Dispatch endpoint missing"
        });
    }
    if (input.target !== "NONE") {
        checks.push({
            key: "auth",
            ok: input.authConfigured,
            detail: input.authConfigured ? "Dispatch auth configured" : "Dispatch auth credentials missing"
        });
    }
    if (input.mtlsConfigured) {
        checks.push({
            key: "mtls",
            ok: true,
            detail: "Client certificate transport configured"
        });
    }
    return {
        ready: checks.every((check) => check.ok),
        checks
    };
}
//# sourceMappingURL=dispatchContractValidationService.js.map