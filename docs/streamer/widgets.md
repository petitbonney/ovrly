# Widgets

A widget is an overlay: a web page you add to OBS as a **Browser Source**. Drop one from the library's **Widget** section onto a workflow: that makes a new widget and its **widget node**. Deleting the node deletes the widget.

![A Dice widget node: its settings, with its OBS link, live preview and Start, Stop, Cancel](/screenshots/widget-node.png)

Its settings have the inputs of the action it runs (e.g. **Start**: the text to show), then **Widget**: its name and look, shared by every node that uses it. The live column has its **OBS browser source** link, a preview, and **Start**, **Stop** and **Cancel**.

## In a workflow

When the flow reaches a widget node, the widget **starts** (an alert shows, the wheel spins) and the node keeps firing until the widget has stopped. Then its result joins the data (the lottery's `{{winner}}`) and the flow goes on.

- **Stop** ends it properly: the wheel lands on its winner, an alert fades out, a vote closes. The workflow goes on.
- **Cancel** cuts it: the wheel freezes, the alert disappears. The workflow stops there. Cancelling a workflow cancels its widgets.
- Starting a widget that is still playing replaces what plays. To play them one after another, put a **Queue** in front.

### More actions

To run another action, e.g. `!stop` to stop the wheel or `!vote` to vote, link a **Widget Action** node in front of the widget node. Its settings pick the action and ask for its inputs (`vote`: the option and who votes). The ⓘ next to a widget node's name lists its actions.

## Widget types

### Alerts

![An alert in the flap board layout](/screenshots/overlay-alerts.png)

Shows a text for a few seconds, in one of ten layouts: banner, neon sign, ticket, speech bubble, arcade, flap board, trophy (3D), sticky note, marquee or particles. A new alert replaces the one showing, except on the ticket, flap board and marquee (queued, one after another) and sticky notes (stacked). Most layouts play sounds, made in the page, at a volume you set (0 mutes them).

### Label

A text that stays on screen until it changes or stops: the last follower, the current goal. Any [Google Fonts](https://fonts.google.com) family, picked by name (the overlay loads it, so it needs internet).

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

Turns chat into key presses through a list of command → keys (`up` → `Up`); a Key Press node set to `{{keys}}` presses them. **Anarchy** passes on every command; **democracy** counts one vote per viewer in rounds, and passes on each round's winner. Use Key Press's "Only when focused" so keys only reach the game window.

## Merge Widgets

One browser source for several widgets. Link widget nodes into a **Merge Widgets** node: its settings show a 16:9 canvas with each widget live. Drag a widget to move it, its corner to resize it; boxes snap to the borders, center lines and other widgets (hold Alt to place freely). Its link shows them all where you placed them, scaled to any source size.

![Merge Widgets: a label and a wheel placed on one canvas](/screenshots/merge.png)
