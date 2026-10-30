# The editor

![The editor: workflows on the left, the graph in the middle, the node library on the right](/screenshots/editor.png)

## Left: workflows

- **+** opens the New workflow dialog (blank, which starts in the [Basic view](#basic-a-list-of-steps), import or a [template](./templates)).
- The **switch** next to a workflow turns it off: what it is running is cancelled, and its triggers ignore chat and API calls. A trigger's **⚡** still fires it, to try it.
- A **spinner** shows next to a running workflow. Hover it and it becomes **■ Stop**: it cancels what that workflow is running, without opening it.
- **EMERGENCY** turns every workflow off at once, then offers to turn them back on.
- Below, one row per integration you set up (✓ connected, ! failing; its tooltip says more), opening its settings. **Settings** has them all, plus variables, custom nodes and widgets, LAN and the theme.

## Middle: Basic or Graph

**Basic | Graph**, right of the workflow's name in the toolbar, picks how the workflow shows. Each workflow remembers its choice; a Blank one starts in Basic.

### Basic: a list of steps

For one-line workflows, e.g. an alert on a new follower: a trigger under **When**, then the steps it runs, in order, under **Then**.

![The Basic view: Follow, then an Alerts widget](/screenshots/basic-view.png)

- **Pick the trigger** and **add steps** from the library (double-click, or drag onto the list): a step goes at the end. The dashed **+** below the steps marks where the next one goes.
- **Click** a step to open its settings. **Drag** it by its grip (left of the card) to move it, the other steps making room; its **⋯** menu also moves it up or down, or deletes it (the steps around it stay linked).
- The **⚡** left of the trigger fires it (see [Fire a trigger](#fire-a-trigger)).
- The library leaves out what makes branches (If / Else, Switch, Fan Out…): its link at the bottom switches to the graph for those.

Basic is available while the workflow is one line: one trigger, each node linked to the next only (from its first output: If / Else's "true", Cooldown's "pass"). Once the graph has a branch, Basic is greyed out; remove the branch and it comes back.

### Graph

The toolbar has undo/redo, the workflow's name, Basic | Graph, then export, delete, and show/hide the library.

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

## Fire a trigger

Every trigger has a **⚡** on its left, on the graph and in the Basic view: it fires the trigger as if its event had happened, e.g. a cheer of 100 bits, and the workflow runs from there. The nodes after it really run: a chat reply is sent, a scene switches.

Its settings have a **Fire** section in their live column: what the event carries (the bits and who cheered, a chat command's args, user and role…), then **Fire** and what the trigger output. What you type there is saved with the node, and the ⚡ uses it too. It starts from values the trigger's settings let through, e.g. Minimum bits; an event they filter out doesn't fire, and Ovrly says so.

- A **Manual Trigger** fires with its Data (JSON).
- A **Schedule** fires now, whatever its interval.
- A **Control Pad** fires its first button; its buttons in the live column fire the others.
- **Channel Points** fires the reward set, without its IDs: Channel Points Redemption can't fulfill or refund it.

## Right: the library

Every node and widget type, in sections: **Trigger**, **Logic**, **Action**, **Widget**. Search it from the top. See [Nodes](./nodes) and [Widgets](./widgets).

## Developer mode

Ctrl+Shift+D (Ctrl on macOS too) shows a tool button at the bottom right: it opens the last 200 events Ovrly saw (chat, API calls, widget actions, logs), handy to see why a workflow didn't fire.
