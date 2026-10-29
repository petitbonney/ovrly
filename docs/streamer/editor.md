# The editor

![The editor: workflows on the left, the graph in the middle, the node library on the right](/screenshots/editor.png)

## Left: workflows

- **+** opens the New workflow dialog (blank, import or a [template](./templates)).
- The **switch** next to a workflow turns it off: what it is running is cancelled, and its triggers ignore chat and API calls. ▶ Run still works, to try it.
- **EMERGENCY** turns every workflow off at once, then offers to turn them back on.
- Below, one row per integration you set up (✓ connected, ! failing; its tooltip says more), opening its settings. **Settings** has them all, plus variables, custom nodes and widgets, LAN and the theme.

## Middle: the graph

The toolbar has undo/redo, the workflow's name, ▶ (runs its Manual Triggers) and ■ (stops it, cancelling what runs), then export, delete, and show/hide the library.

- **Add a node**: drag it from the library, or double-click it (or press Enter on it): it is added after the selected node, and linked from it.
- **Link** nodes by dragging from an output (right) to an input (left). Data flows along the links.
- **Copy/paste**: Ctrl/⌘+C, Ctrl/⌘+V, also into another workflow.
- **Undo/redo**: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z (or Ctrl+Y).
- **Controls** (top left): lock (nodes can't be moved, linked or deleted), zoom, fit view, and arrange (lays the graph out left to right).

While a workflow runs, the graph shows it: a running node pulses blue, a finished one flashes green, one that stopped the flow (e.g. a filter that didn't match) dims, a failing one turns red until it runs again, and links carrying data animate.

A node with a **plug icon** needs something that isn't ready yet, e.g. Twitch in Streamer mode: its settings say what, with a link to fix it.

## Bottom: the settings pane

Click a node to open its settings. Every node has the same layout: a one-line description, notices (yellow: won't run yet; red: broken), its settings on the left and, when there is something to watch or press, a live column on the right.

![The settings of a Cooldown node](/screenshots/node-settings.png)

Changes save by themselves. Text settings take [`{{ }}` expressions](./data#expressions): the **{ }** menu inserts data from earlier nodes, e.g. `{{user}}`.

Some actions (HTTP Request, Switch Scene, Hue Lights…) have a **Play** button in their live column, to try them with their current settings.

## Right: the library

Every node and widget type, in sections: **Trigger**, **Logic**, **Action**, **Widget**. Search it from the top. See [Nodes](./nodes) and [Widgets](./widgets).

## Developer mode

Ctrl+Shift+D (Ctrl on macOS too) shows a tool button at the bottom right: it opens the last 200 events Ovrly saw (chat, API calls, widget actions, logs), handy to see why a workflow didn't fire.
