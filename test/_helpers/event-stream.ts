import EventSource from "eventsource"

interface ServerSentEvent {
  type: string
  data: string | string[]
  origin: string
}

export function recordEventStream(url: string, eventsToRecord: string[]) {
  const eventSource = new EventSource(url)
  const events: (ServerSentEvent & { data: any })[] = []

  const listener = (event: ServerSentEvent) => {
    events.push({
      ...event,
      data:
        !Array.isArray(event.data) && event.data.charAt(0) === "{"
          ? JSON.parse(event.data)
          : event.data
    })
  }

  for (const eventName of eventsToRecord) {
    eventSource.addEventListener(eventName, listener as any)
  }

  return {
    stop() {
      eventSource.close()
      return events
    }
  }
}
