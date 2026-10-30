# Getting started

Ovrly runs on your computer, next to OBS. You draw **workflows**: when something happens on stream (a chat command, a follow, a Stream Deck key), do something (show an alert, switch a scene, flash the lights). The editor opens in your browser.

::: warning Prototype
Ovrly is a prototype: Twitch and OBS only, for now. Expect rough edges, and keep a backup of your `data` folder.
:::

## Download

1. Get the zip for your system from the [Releases page](https://github.com/petitbonney/ovrly/releases): macOS (Apple Silicon or Intel) or Windows.
2. Unzip it where you want Ovrly to live.
3. Double-click **Start Ovrly.command** (macOS) or **Start Ovrly.bat** (Windows).

Nothing else to install: Node.js comes bundled. The editor opens at [http://localhost:6875](http://localhost:6875). Keep the window that started it open while you stream: closing it stops Ovrly.

::: tip First launch
The app isn't signed, so your system warns you the first time.
- **macOS**: right-click the file → **Open**, then confirm.
- **Windows**: click **More info** → **Run anyway**.
:::

Your workflows and widgets are saved in the `data` folder next to the launcher. To update, unzip a new version over the old one: `data` stays.

## Your first workflow

1. Click **+** next to **Workflows**, or **New workflow**.
2. Pick a template, e.g. **!roll dice**: chat rolls a die with `!roll`.

   ![The New workflow dialog: Blank, Import, and the templates](/screenshots/new-workflow.png)

   Or pick **Blank** to build your own: it opens as a list of steps (the [Basic view](./editor#basic-a-list-of-steps)), a trigger then what it does.

3. Templates start switched off. Connect what the workflow needs first (here, [Twitch](./twitch) to read your chat), then turn on the switch next to its name.
4. Show its widgets in OBS: select the widget node (the die), copy the **OBS browser source** link from its settings, and add it to OBS as a **Browser Source** (see [OBS](./obs#show-a-widget)).

![The !roll dice workflow: Chat !command → Cooldown → Queue → Dice → Roll result](/screenshots/editor.png)

Try it without going live: a Chat !command node's settings have a test **Run** (with the args, user and role you pick), and the ⚡ beside the other chat triggers sends a test message from TestViewer.

## Where to next

- [The editor](./editor): the graph, the library, the settings pane.
- [Templates](./templates): what each one does.
- [Nodes](./nodes) and [Widgets](./widgets): everything you can put in a workflow.
- [Twitch](./twitch), [OBS](./obs), [Stream Deck](./stream-deck), [Philips Hue and Giphy](./hue-giphy): connect your tools.
