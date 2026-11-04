# Developer mode

**Ctrl+Shift+D** (Ctrl on macOS too) toggles it; this browser remembers it. It adds a few tools the Streamer docs leave out. Nodes already placed keep working with it off.

## Events view

A tool button at the bottom right opens the last 200 events Ovrly saw (chat, API calls, widget actions, logs), handy to see why a workflow didn't fire. It's [`GET /api/events`](./api#look-inside) in a new tab.

## Error Trigger

A trigger in the library: a workflow starting with it runs whenever a node fails in another workflow, e.g. to post the error to Discord.

## Log

An action in the library: prints the data to the events view, and shows the last one in its settings.

## Merge Widgets

One browser source for several widgets, in the library's **Widget** section. Link widget nodes into a **Merge Widgets** node: its settings show a 16:9 canvas with each widget live. Drag a widget to move it, its corner to resize it; boxes snap to the borders, center lines and other widgets (hold Alt to place freely). Its **OBS browser source** link (`/m/<workflow>/<node>`) shows them all where you placed them, scaled to any source size.

![Merge Widgets: a label and a wheel placed on one canvas](/screenshots/merge.png)
