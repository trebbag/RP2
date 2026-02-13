import { type DispatchContractTarget, type DispatchContractVendor, type DispatchPayloadInput } from "./ehrContractService.js";
export declare const defaultDispatchValidationPayload: DispatchPayloadInput;
export declare function validateDispatchContract(input: {
    target: DispatchContractTarget;
    vendor?: DispatchContractVendor;
    payload?: unknown;
}): {
    ok: boolean;
    contractType: import("./ehrContractService.js").DispatchContractType;
    contentType: string;
    errors: string[];
};
export declare function dispatchSandboxReadiness(input: {
    target: DispatchContractTarget;
    vendor?: DispatchContractVendor;
    webhookConfigured: boolean;
    mllpConfigured: boolean;
    authConfigured: boolean;
    mtlsConfigured: boolean;
}): {
    ready: boolean;
    checks: {
        key: string;
        ok: boolean;
        detail: string;
    }[];
};
