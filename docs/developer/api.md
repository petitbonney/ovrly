# HTTP API

Ovrly listens on `http://localhost:6875` (set `PORT` to change it). Only this computer reaches it, unless LAN is on (then other devices reach widget pages and `/hooks`, and the rest with the LAN key). Requests from other websites are refused.

## Fire a workflow

| Request | Does |
| --- | --- |
| `ANY /hooks/<path>` | Fires API Call triggers set to `<path>`. The query and JSON body become data. |
| `ANY /hooks/<path>/<name>-<id>` | Presses a Control Pad button (Companion mode). |
| `POST /api/emit/<event>` | Publishes a fake event on the bus, e.g. `chat` with `{ user, message }`. |
| `POST /api/workflows/<id>/run` | Runs a workflow's Manual Triggers (`?node=<id>`: just that trigger). |
| `POST /api/workflows/<id>/cancel` | Cancels its firings in progress. |
| `POST /api/stop` | EMERGENCY: switches every workflow off. |

```bash
curl -X POST localhost:6875/hooks/my-hook -H 'content-type: application/json' -d '{"user": "bob"}'
```

## Widgets

| Request | Does |
| --- | --- |
| `POST /api/widgets/<id>/action` | Runs an action, e.g. `{ "action": "vote", "input": { "option": "1", "user": "bob" } }`. |
| `GET /w/<id>` | The widget's page, for OBS. `/w/<id>/events` streams its state (SSE). |
| `GET /m/<workflow>/<node>` | A Merge Widgets page. |

## Look inside

| Request | Gives |
| --- | --- |
| `GET /api/events` | The last 200 events, tagged by channel (`bus`, `http`, `websocket`, `sse`, `log`). A live table in a browser; JSON otherwise or with `?format=json`. |
| `GET /api/runs` | The last 100 firings, with each node's input and output (`?workflow=<id>` for one). |
| `GET /api/nodes`, `GET /api/widget-types` | Node and widget types, with their settings. |
| `GET /api/workflows`, `GET /api/widgets` | What's saved. |

The editor uses the rest of `/api`; see `server/index.js`, where each route says what it does.
