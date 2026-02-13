export type AlertSeverity = "info" | "warning" | "critical";
interface AlertInput {
    source: string;
    event: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    details?: Record<string, unknown>;
}
export declare function sendOperationalAlert(input: AlertInput): Promise<void>;
export {};
