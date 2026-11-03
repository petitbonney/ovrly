# Widgets

A widget is an overlay: a web page you add to OBS as a **Browser Source**. Drop one from the library's **Widget** section onto a workflow: that makes a new widget and its **widget node**. Deleting the node deletes the widget.

![A Dice widget node: its settings, with its OBS link, live preview and Start, Stop, Cancel](/screenshots/widget-node.png)

Its settings have tabs: **Widget** first, its look, shared by every node that uses it, then a tab per port with its action's inputs (e.g. **Start**: the text to show). Double-click its name, at the top of its settings, to rename it; the **⋯** beside it copies the node (to paste a new widget with the same settings) or its instance ID. The live column has its **OBS browser source** link, a preview, and **Start**, **Stop** and **Cancel**.

## In a workflow

When the flow reaches a widget node, the widget **starts** (an alert shows, the wheel spins) and the node keeps firing until the widget has stopped. Then its result joins the data (the lottery's `{{winner}}`) and the flow goes on.

- **Stop** ends it properly: the wheel lands on its winner, an alert fades out, a vote closes. The workflow goes on.
- **Cancel** cuts it: the wheel freezes, the alert disappears. The workflow stops there. Cancelling a workflow cancels its widgets.
- Starting a widget that is still playing replaces what plays. To play them one after another, put a **Queue** in front.

### More actions

A widget node has one input, its main **port**: a link into it runs the start action. To run another action, e.g. `!stop` to stop the wheel or `!vote` to vote, click **+** beside its settings' tabs and pick it (in the Basic view, which shows the start action alone, this switches to the Graph view): the node gets a port named after it, and a link into that port runs that action (the workflow stops there). Its **×** takes the port off again, with its links. Drag the tabs to reorder the ports on the node (the start one stays first).

Each port has a tab, with what its action does and its inputs (`vote`: the option and who votes; a countdown's `add`: the time). Every link into a port runs its action with these inputs, so to give two links different ones, set a data key on the way and use it: the Subathon template's **Edit Data** nodes set `time` to `+5m` for a sub and `+{{ Math.floor(bits / 100) }}m` for a cheer, and `add` takes `{{time}}`.

Workflows made with the former **Widget Action** node are turned into links into ports when Ovrly starts.

## Widget types

### Alerts

![An alert in the flap board layout](/screenshots/overlay-alerts.png)

Shows a text for a few seconds, in one of ten layouts: banner, neon sign, ticket, speech bubble, arcade, flap board, trophy (3D), sticky note, marquee or particles. A new alert replaces the one showing, except on the ticket, flap board and marquee (queued, one after another) and sticky notes (stacked). Most layouts play sounds, made in the page, at a volume you set (0 mutes them).

### Label

A text that stays on screen until it changes or stops: the last follower, the current goal. Any [Google Fonts](https://fonts.google.com) family, picked by name (the overlay loads it, so it needs internet).

### Countdown, Timer

A clock as a text around `{time}`, e.g. `Starting in {time}`, in any Google Fonts family. Its format: **Auto** (`1:05:03`, then `4:59`), `hh:mm:ss` or `mm:ss`. Both stay on screen (hide them in OBS) and go on across a restart of Ovrly. Their Stop pauses them, their Cancel resets them, and Start only starts one that is paused or reset.

- **Countdown**: Start counts down **for** a duration (`5m`, `1h30m`, `1:30`, or `{{args}}` from a chat command) or **until** a time of day (`20:00`, `8pm`); before that, it shows that time. The workflow goes on once it reaches 0, when the **ended text** shows instead (e.g. `Starting now!`; empty, `0:00` stays). `add` adds time or takes some off (`+30s` per sub for a subathon, `-1m`), and its end follows. **Pause** holds it, and the workflow waiting on it goes on; **Reset** brings it back to before its start, and that workflow stops there. The last 10 seconds beat (**Pulse**). It outputs `{{remaining}}`.
- **Timer**: counts up from 0, for a speedrun or a challenge, like a stopwatch: **Pause** holds it, **Reset** stops it at 0. The workflow goes on at once. Every action outputs `{{elapsed}}` (as shown) and `{{seconds}}`, e.g. for a `!time` command to answer in chat.

### Image/GIF, Sound, Video

Show an image or GIF, play a sound, or play a short video (mp4 or webm), then fade out. Each takes a file on disk (**Browse files**), a URL, or a URL from an earlier node, e.g. `{{gif}}` from GIPHY or `{{sound}}` from MyInstants. Sound and video have a max duration and a volume.

::: tip Sound in OBS
Tick **Control audio via OBS** on the browser source, so the sound reaches your stream.
:::

### Voting

![A chat poll with live results](/screenshots/overlay-voting.png)

A **poll** (the most voted option leads) or a **prediction** (viewers bet, then "win" reveals who guessed right), open for its duration after Start, or until Stop.

- **Chat** mode: viewers vote through the `vote` action, e.g. `!vote 2` or `!vote red`, one vote per viewer. Works in Guest or Streamer mode.
- **Twitch** mode (Streamer mode, Affiliates and Partners): a native Twitch poll or prediction with channel points, its results live.

It outputs `{{winner}}`, `{{votes}}` and `{{winners}}` (who bet right).

### Lottery, Roulette, Dice Roll

![The lottery's wheel, landed on its winner](/screenshots/overlay-wheel.png)

They draw a `{{winner}}`:
- **Lottery**: a wheel or a slot reel, its options typed in or added by the workflow (`load`, `loadAll`, `clear`). Each option has a label, a color and a weight: a bigger weight is a likelier winner. The winner stays shown until reset or the next draw.
- **Roulette**: a number from 0 to 36.
- **Dice Roll**: a 3D die with six faces of your own (1 to 6 show as dots), rolled with real physics.

### TwitchPlays

Turns chat into key presses through a list of keys and the commands that press them (`Up` ← `up`, `u`; any of a row's commands); a Key Press node set to `{{keys}}` presses them. **Anarchy** passes on every command; **democracy** counts one vote per viewer in rounds, and passes on each round's winner. The overlay fits its source: anarchy lists as many of the latest commands as fit, democracy shrinks its vote so every command shows. Use Key Press's "Only when focused" so keys only reach the game window.

## Merge Widgets

One browser source for several widgets, listed in the library in [developer mode](./editor#developer-mode) only. Link widget nodes into a **Merge Widgets** node: its settings show a 16:9 canvas with each widget live. Drag a widget to move it, its corner to resize it; boxes snap to the borders, center lines and other widgets (hold Alt to place freely). Its link shows them all where you placed them, scaled to any source size.

![Merge Widgets: a label and a wheel placed on one canvas](/screenshots/merge.png)
