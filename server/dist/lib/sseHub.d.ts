import type { Response } from "express";
export interface SseEventPayload {
    type: string;
    data: unknown;
}
declare class SseHub {
    private clients;
    subscribe(encounterId: string, clientId: string, response: Response): void;
    unsubscribe(encounterId: string, clientId: string): void;
    publish(encounterId: string, event: SseEventPayload): void;
    private write;
}
export declare const sseHub: SseHub;
export {};
