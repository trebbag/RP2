export interface DispatchPayloadInput {
    encounterExternalId: string;
    patientExternalId: string;
    providerName: string;
    noteContent: string;
    patientSummary: string;
    billing: {
        payerModel: string;
        selectedCptCodes: string[];
        estimatedChargeCents: number;
        expectedReimbursementCents: number;
    };
    artifacts: Array<{
        id: string;
        type: string;
        fileName: string;
    }>;
    dispatchMetadata?: {
        idempotencyKey?: string;
        contractVersion?: string;
        dispatchedAt?: string;
    };
}
export type DispatchContractType = "FHIR_BUNDLE_R4" | "HL7_ORU_R01" | "VENDOR_JSON" | "NONE";
export type DispatchContractTarget = "FHIR_R4" | "HL7_V2" | "VENDOR_API" | "NONE";
export type DispatchContractVendor = "GENERIC" | "ATHENAHEALTH" | "NEXTGEN" | "ECLINICALWORKS";
export interface DispatchContractResult {
    contractType: DispatchContractType;
    contentType: string;
    body: string;
}
export declare function buildDispatchContract(payload: DispatchPayloadInput): DispatchContractResult;
export declare function buildDispatchContractForConfig(payload: DispatchPayloadInput, config: {
    target: DispatchContractTarget;
    vendor?: DispatchContractVendor;
}): DispatchContractResult;
