class SseHub {
    clients = new Map();
    subscribe(encounterId, clientId, response) {
        const heartbeat = setInterval(() => {
            this.write(response, "heartbeat", { ts: new Date().toISOString() });
        }, 15000);
        const key = `${encounterId}:${clientId}`;
        const client = { id: clientId, encounterId, response, heartbeat };
        this.clients.set(key, client);
        response.on("close", () => {
            this.unsubscribe(encounterId, clientId);
        });
    }
    unsubscribe(encounterId, clientId) {
        const key = `${encounterId}:${clientId}`;
        const client = this.clients.get(key);
        if (!client)
            return;
        clearInterval(client.heartbeat);
        this.clients.delete(key);
    }
    publish(encounterId, event) {
        for (const client of this.clients.values()) {
            if (client.encounterId === encounterId) {
                this.write(client.response, event.type, event.data);
            }
        }
    }
    write(response, event, data) {
        response.write(`event: ${event}\n`);
        response.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}
export const sseHub = new SseHub();
//# sourceMappingURL=sseHub.js.map