import { env } from "../config/env.js";
function toIsoTimestamp() {
    return new Date().toISOString();
}
function toCentsDollars(cents) {
    return Number((cents / 100).toFixed(2));
}
function sanitizeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function buildFhirBundle(payload) {
    const timestamp = toIsoTimestamp();
    const encounterRef = `Encounter/${payload.encounterExternalId}`;
    const patientRef = `Patient/${payload.patientExternalId}`;
    const idempotencyKey = payload.dispatchMetadata?.idempotencyKey || payload.encounterExternalId;
    const contractVersion = payload.dispatchMetadata?.contractVersion || "v1";
    const bundle = {
        resourceType: "Bundle",
        type: "collection",
        timestamp,
        identifier: {
            system: "urn:revenuepilot:dispatch-idempotency",
            value: idempotencyKey
        },
        meta: {
            tag: [
                {
                    system: "urn:revenuepilot:contract-version",
                    code: contractVersion
                }
            ]
        },
        entry: [
            {
                resource: {
                    resourceType: "Patient",
                    id: payload.patientExternalId,
                    identifier: [{ system: "urn:revenuepilot:patient-id", value: payload.patientExternalId }]
                }
            },
            {
                resource: {
                    resourceType: "Encounter",
                    id: payload.encounterExternalId,
                    status: "finished",
                    subject: { reference: patientRef },
                    period: { end: timestamp },
                    participant: [{ individual: { display: payload.providerName } }]
                }
            },
            {
                resource: {
                    resourceType: "Composition",
                    id: `comp-${payload.encounterExternalId}`,
                    status: "final",
                    type: {
                        coding: [{ system: "http://loinc.org", code: "34109-9", display: "Note" }]
                    },
                    subject: { reference: patientRef },
                    encounter: { reference: encounterRef },
                    date: timestamp,
                    author: [{ display: payload.providerName }],
                    title: "Final Clinical Note",
                    section: [
                        {
                            title: "Clinical Note",
                            text: {
                                status: "generated",
                                div: `<div>${sanitizeHtml(payload.noteContent).replace(/\n/g, "<br/>")}</div>`
                            }
                        },
                        {
                            title: "Patient Summary",
                            text: {
                                status: "generated",
                                div: `<div>${sanitizeHtml(payload.patientSummary).replace(/\n/g, "<br/>")}</div>`
                            }
                        }
                    ]
                }
            },
            {
                resource: {
                    resourceType: "Claim",
                    id: `claim-${payload.encounterExternalId}`,
                    status: "active",
                    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
                    patient: { reference: patientRef },
                    provider: { display: payload.providerName },
                    created: timestamp.slice(0, 10),
                    identifier: [
                        {
                            system: "urn:revenuepilot:claim-idempotency",
                            value: idempotencyKey
                        }
                    ],
                    item: payload.billing.selectedCptCodes.map((code, index) => ({
                        sequence: index + 1,
                        productOrService: {
                            coding: [{ system: "http://www.ama-assn.org/go/cpt", code }]
                        }
                    })),
                    total: {
                        value: toCentsDollars(payload.billing.estimatedChargeCents),
                        currency: "USD"
                    }
                }
            }
        ]
    };
    return {
        contractType: "FHIR_BUNDLE_R4",
        contentType: "application/fhir+json",
        body: JSON.stringify(bundle)
    };
}
function sanitizeHl7Field(value) {
    return value.replace(/[|\^~\\&\r\n]/g, " ").trim();
}
function buildHl7Message(payload) {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
    const idempotencyKey = sanitizeHl7Field(payload.dispatchMetadata?.idempotencyKey || payload.encounterExternalId);
    const contractVersion = sanitizeHl7Field(payload.dispatchMetadata?.contractVersion || "v1");
    const lines = [
        `MSH|^~\\&|RP2|REVENUEPILOT|EHR|TARGET|${ts}||ORU^R01|${payload.encounterExternalId}|P|2.5.1`,
        `PID|1||${sanitizeHl7Field(payload.patientExternalId)}^^^^MR||UNKNOWN^PATIENT`,
        `PV1|1|O|CLINIC||||${sanitizeHl7Field(payload.providerName)}`,
        `OBR|1|||CLINICAL_NOTE^Clinical Note`,
        `OBX|1|TX|NOTE^Final Clinical Note||${sanitizeHl7Field(payload.noteContent)}`,
        `OBX|2|TX|SUMMARY^Patient Summary||${sanitizeHl7Field(payload.patientSummary)}`,
        `OBX|3|TX|BILLING^Billing Summary||PAYER=${sanitizeHl7Field(payload.billing.payerModel)};CPT=${payload.billing.selectedCptCodes.join(",")};CHARGE=${toCentsDollars(payload.billing.estimatedChargeCents)}`,
        `ZDS|${idempotencyKey}|${contractVersion}`
    ];
    return {
        contractType: "HL7_ORU_R01",
        contentType: "text/plain",
        body: `${lines.join("\r")}\r`
    };
}
function buildVendorPayload(payload, vendor) {
    const idempotencyKey = payload.dispatchMetadata?.idempotencyKey || payload.encounterExternalId;
    const contractVersion = payload.dispatchMetadata?.contractVersion || "v1";
    const common = {
        encounterId: payload.encounterExternalId,
        patientId: payload.patientExternalId,
        provider: payload.providerName,
        note: payload.noteContent,
        patientSummary: payload.patientSummary,
        billing: payload.billing,
        artifacts: payload.artifacts,
        dispatchMetadata: {
            idempotencyKey,
            contractVersion,
            dispatchedAt: payload.dispatchMetadata?.dispatchedAt || toIsoTimestamp()
        }
    };
    const vendorPayload = vendor === "ATHENAHEALTH"
        ? {
            sourceSystem: "RevenuePilot",
            athenaEncounterId: payload.encounterExternalId,
            patientEnterpriseId: payload.patientExternalId,
            clinicianName: payload.providerName,
            clinicalDocument: payload.noteContent,
            patientFacingSummary: payload.patientSummary,
            chargeCapture: {
                cptCodes: payload.billing.selectedCptCodes,
                estimatedChargeDollars: toCentsDollars(payload.billing.estimatedChargeCents)
            },
            attachments: payload.artifacts,
            dispatchMetadata: common.dispatchMetadata
        }
        : vendor === "NEXTGEN"
            ? {
                msgType: "FinalizedEncounter",
                nextgen: {
                    encounterNumber: payload.encounterExternalId,
                    patientMrn: payload.patientExternalId,
                    renderingProvider: payload.providerName
                },
                payload: common
            }
            : vendor === "ECLINICALWORKS"
                ? {
                    apiVersion: "v1",
                    action: "upsertEncounterNote",
                    eClinicalWorks: {
                        patientId: payload.patientExternalId,
                        encounterId: payload.encounterExternalId
                    },
                    payload: common
                }
                : {
                    vendor: "GENERIC",
                    payload: common
                };
    return {
        contractType: "VENDOR_JSON",
        contentType: "application/json",
        body: JSON.stringify(vendorPayload)
    };
}
export function buildDispatchContract(payload) {
    return buildDispatchContractForConfig(payload, {
        target: env.DISPATCH_TARGET,
        vendor: env.DISPATCH_VENDOR
    });
}
export function buildDispatchContractForConfig(payload, config) {
    switch (config.target) {
        case "FHIR_R4":
            return buildFhirBundle(payload);
        case "HL7_V2":
            return buildHl7Message(payload);
        case "VENDOR_API":
            return buildVendorPayload(payload, config.vendor ?? "GENERIC");
        default:
            return {
                contractType: "NONE",
                contentType: "application/json",
                body: JSON.stringify({
                    dispatched: false,
                    reason: "DISPATCH_TARGET=NONE"
                })
            };
    }
}
//# sourceMappingURL=ehrContractService.js.map