# Nodes

Every node type, as the library lists them. **Needs** says what has to be set up first: **chat** is the Twitch chat (Guest or Streamer mode), **Twitch** is [Streamer mode](./twitch#guest-or-streamer). Each node's settings describe the rest.

## Triggers

A workflow starts at a trigger.

| Node | Fires when | Needs |
| --- | --- | --- |
| Manual Trigger | you press ▶ Run in the toolbar, or the ⚡ on the node | |
| Chat !command | a chat message starts with a command, e.g. `!spin red`, from viewers of at least a role | chat |
| Chat Message | any chat message | chat |
| Channel Points | a viewer redeems a channel points reward | Twitch |
| Follow | someone follows the channel | Twitch |
| Subscription | someone gets a sub: new, resub or gifted (`kind` says which) | chat |
| Raid | another channel raids yours | chat |
| Cheer | someone cheers bits | chat |
| Gift Subs | someone gifts subs, once, with how many and to whom | chat |
| Hype Train | a Hype Train starts, moves on or ends | Twitch |
| Stream On/Off | the stream goes live or ends (`status` says which) | Twitch |
| Schedule | every so often, while the workflow is on | |
| API Call | a request reaches `http://localhost:6875/hooks/<path>`; its query and JSON body become data | |
| Control Pad | a button is pressed: a [Stream Deck](./stream-deck) key, or a URL per button for Companion | |
| Called By Workflow | another workflow runs this one (Execute Workflow) | |
| Error Trigger | a node fails in another workflow | |

Subs, gift subs, cheers and raids work in Guest mode too, from what chat announces.

## Logic

| Node | What it does |
| --- | --- |
| Filter | Continues only if a comparison holds (equals, contains, regex, numbers, empty…). |
| If / Else | Sends data to "true" or "false" by comparing two values. |
| Switch | Sends data to the first case equal to a value, one output per case, else to "else". |
| Delay | Waits before passing data on. |
| Cooldown | Lets data through, then sends the next to "blocked" for a while, for everyone and optionally per viewer. |
| Queue | Runs what follows one firing at a time; the next wait in line. Its settings show the line. |
| Wait For All | Continues once every incoming link has delivered, with their data merged. Force or Cancel from its settings. |
| Fan Out | Runs what follows once per item of a list, e.g. a gift's recipients. |
| Fan In | Collects firings into one `{{items}}` list with `{{count}}`, released after a duration, a quiet period or a limit. Optionally one entry per key, e.g. `!join` sign-ups. |
| Pipe | Passes its input on unchanged (to tidy up links). |
| Execute Workflow | Runs another workflow (from its Called By Workflow trigger) and waits for its result. |
| Edit Data | Adds or overwrites data keys, for this run only. |
| Map Value | Replaces a key's value using a "from" → "to" list. |
| Edit Variable | Sets, adds to or deletes a [variable](./data#variables). |
| Code | Runs JavaScript on the data; its live column tests it on a recent input. |

## Actions

| Node | What it does | Needs |
| --- | --- | --- |
| Widget Action | Runs another action on a widget (stop, vote, spin…): see [Widgets](./widgets#more-actions). | |
| Key Press | Presses a key combo on this computer, optionally only while a given window is focused. | |
| HTTP Request | Sends an HTTP request, e.g. a Discord webhook. | |
| WebSocket Send | Opens a WebSocket, sends one message, then closes. | |
| Log | Prints the data to the events view, and shows the last one in its settings. | |
| GIPHY | Finds a GIF, sticker or clip and adds its URL (`{{gif}}`, `{{sticker}}`, `{{clip}}`). | [Giphy](./hue-giphy#giphy) |
| MyInstants | Finds a sound on Myinstants and adds its URL as `{{sound}}`. | |
| Hue Lights | Toggles, sets or turns off lights, or plays a routine of colors. | [Hue](./hue-giphy#philips-hue) |
| Switch Scene | Switches the OBS program scene, and back after a while if set. | [OBS](./obs) |
| Toggle Source | Shows, hides or toggles a source in an OBS scene. | [OBS](./obs) |

### Twitch actions

All need [Streamer mode](./twitch#guest-or-streamer).

| Node | What it does |
| --- | --- |
| Send Chat Message | Sends a message as the streamer, or a reply to one. |
| Announcement | Posts a chat announcement, highlighted in a color. |
| Shoutout | Gives another channel a shoutout (while live; one every 2 minutes). |
| Ban / Timeout | Times out, bans or unbans a viewer. |
| Delete Message | Deletes a chat message, e.g. the one that fired the trigger. |
| Chat Mode | Emote-only, followers-only, subscribers-only, slow or unique chat: on, off or toggled. |
| Stream Info | Changes the title, category or tags. |
| Channel Info | Gets a channel's stream, follower and sub counts, last clip or next scheduled stream. |
| User Info | Looks up a viewer: avatar, account age, follow age, sub tier, last category. |
| Ad Break | Starts an ad break, or snoozes the next one by 5 minutes. |
| Create Clip | Clips the last moments of the stream and adds its URL as `{{clipUrl}}`. |
| Stream Marker | Adds a marker, to find the moment in the VOD. |
| Raid | Raids another channel, or cancels the pending raid. |
| Channel Points Reward | Enables, disables, pauses or resumes a reward made by Ovrly (made the first time). |
| Complete Redemption | Marks a redemption fulfilled, or refunds it (rewards made by Ovrly only). |

## Widgets

The **Widget** section of the library has every [widget type](./widgets), and **Merge Widgets** to put several on one browser source.
