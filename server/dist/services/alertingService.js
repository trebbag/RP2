import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
function normalizeSeverity(severity) {
    if (severity === "critical")
        return "error";
    return severity;
}
function slackColor(severity) {
    if (severity === "critical")
        return "#d00000";
    if (severity === "warning")
        return "#f59f00";
    return "#228be6";
}
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Alert sink failed (${response.status}): ${text.slice(0, 280)}`);
    }
}
async function sendPagerDutyAlert(input) {
    if (!env.PAGERDUTY_ROUTING_KEY) {
        throw new Error("PAGERDUTY_ROUTING_KEY missing");
    }
    await postJson("https://events.pagerduty.com/v2/enqueue", {
        routing_key: env.PAGERDUTY_ROUTING_KEY,
        event_action: "trigger",
        dedup_key: `${input.source}:${input.event}`,
        payload: {
            summary: input.title,
            severity: normalizeSeverity(input.severity),
            source: input.source,
            custom_details: {
                message: input.message,
                ...input.details
            }
        }
    });
}
async function sendSlackAlert(input) {
    if (!env.ALERT_SLACK_WEBHOOK_URL) {
        throw new Error("ALERT_SLACK_WEBHOOK_URL missing");
    }
    await postJson(env.ALERT_SLACK_WEBHOOK_URL, {
        text: `[${input.severity.toUpperCase()}] ${input.title}`,
        attachments: [
            {
                color: slackColor(input.severity),
                fields: [
                    { title: "Source", value: input.source, short: true },
                    { title: "Event", value: input.event, short: true },
                    { title: "Message", value: input.message, short: false }
                ],
                footer: "RevenuePilot"
            }
        ]
    });
}
async function sendWebhookAlert(input) {
    if (!env.ALERT_WEBHOOK_URL) {
        throw new Error("ALERT_WEBHOOK_URL missing");
    }
    await postJson(env.ALERT_WEBHOOK_URL, {
        ts: new Date().toISOString(),
        source: input.source,
        event: input.event,
        severity: input.severity,
        title: input.title,
        message: input.message,
        details: input.details ?? {}
    });
}
export async function sendOperationalAlert(input) {
    const sinks = [];
    if (env.ALERT_WEBHOOK_URL)
        sinks.push(sendWebhookAlert(input));
    if (env.ALERT_SLACK_WEBHOOK_URL)
        sinks.push(sendSlackAlert(input));
    if (env.PAGERDUTY_ROUTING_KEY)
        sinks.push(sendPagerDutyAlert(input));
    if (sinks.length === 0) {
        logger.warn("alerts.no_sink_configured", {
            event: input.event,
            source: input.source,
            severity: input.severity
        });
        return;
    }
    const results = await Promise.allSettled(sinks);
    const rejected = results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
        logger.error("alerts.sink_delivery_failed", {
            event: input.event,
            errors: rejected.map((result) => result.status === "rejected" && result.reason instanceof Error
                ? result.reason.message
                : String(result.reason))
        });
    }
}
//# sourceMappingURL=alertingService.js.map