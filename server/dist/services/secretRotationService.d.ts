interface RotationEventInput {
    actorId: string;
    ticketId: string;
    secrets: string[];
    notes?: string;
    rotatedAt?: string;
}
export declare function recordSecretRotationEvent(input: RotationEventInput): Promise<{
    ticketId: string;
    secrets: string[];
    rotatedAt: string;
}>;
export declare function getSecretRotationStatus(): Promise<{
    policy: {
        maxAgeDays: number;
    };
    latestRotation: {
        ticketId: string;
        rotatedAt: string;
        actorId: string;
    };
    secretsTracked: {
        secret: string;
        rotatedAt: string;
        ageDays: number;
        withinPolicy: boolean;
    }[];
    staleSecrets: {
        secret: string;
        rotatedAt: string;
        ageDays: number;
        withinPolicy: boolean;
    }[];
    hasRecordedRotation: boolean;
}>;
export {};
