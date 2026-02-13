import type { Response } from "express"

interface SseClient {
  id: string
  encounterId: string
  response: Response
  heartbeat: NodeJS.Timeout
}

export interface SseEventPayload {
  type: string
  data: unknown
}

class SseHub {
  private clients = new Map<string, SseClient>()

  subscribe(encounterId: string, clientId: string, response: Response) {
    const heartbeat = setInterval(() => {
      this.write(response, "heartbeat", { ts: new Date().toISOString() })
    }, 15000)

    const key = `${encounterId}:${clientId}`
    const client: SseClient = { id: clientId, encounterId, response, heartbeat }
    this.clients.set(key, client)

    response.on("close", () => {
      this.unsubscribe(encounterId, clientId)
    })
  }

  unsubscribe(encounterId: string, clientId: string) {
    const key = `${encounterId}:${clientId}`
    const client = this.clients.get(key)
    if (!client) return

    clearInterval(client.heartbeat)
    this.clients.delete(key)
  }

  publish(encounterId: string, event: SseEventPayload) {
    for (const client of this.clients.values()) {
      if (client.encounterId === encounterId) {
        this.write(client.response, event.type, event.data)
      }
    }
  }

  private write(response: Response, event: string, data: unknown) {
    response.write(`event: ${event}\n`)
    response.write(`data: ${JSON.stringify(data)}\n\n`)
  }
}

export const sseHub = new SseHub()
