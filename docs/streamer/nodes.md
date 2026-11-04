# Nodes

Every node type, as the library lists them. **Needs** says what has to be set up first: **chat** is the Twitch chat (Guest or Streamer mode), **Twitch** is [Streamer mode](./twitch#guest-or-streamer). Each node's settings describe the rest.

## Triggers

A workflow starts at a trigger. Its **⚡** fires it by hand, to try the workflow (see [Fire a trigger](./editor#fire-a-trigger)).

| Node | Fires when | Needs |
| --- | --- | --- |
| Manual Trigger | you press the ⚡ on the node | |
| Control Pad | a button is pressed: a [Stream Deck](./stream-deck) key, or a URL per button for Companion | |
| Chat !command | a chat message starts with a command, e.g. `!spin red`, from viewers of at least a role | chat |
| Chat Message | any chat message | chat |
| Channel Points | a viewer redeems a channel points reward | Twitch |
| Follow | someone follows the channel | Twitch |
| Subscription | someone gets a sub: new, resub or gifted (`subKind` says which) | chat |
| Raid | another channel raids yours | chat |
| Cheer | someone cheers bits | chat |
| Gift Subs | someone gifts subs, once, with how many and to whom | chat |
| Hype Train | a Hype Train starts, moves on or ends | Twitch |
| Stream On/Off | the stream goes live or ends (`streamStatus` says which) | Twitch |
| Schedule | every so often, while the workflow is on | |
| API Call | a request reaches `http://localhost:6875/hooks/<path>`; its query and JSON body become data | |
| Portal In | a Portal Out node sends data through it, from this workflow or another | |

Subs, gift subs, cheers and raids work in Guest mode too, from what chat announces.

## Logic

| Node | What it does |
| --- | --- |
| Waypoint | Passes its input on unchanged (to tidy up links). |
| If / Else | Sends data to "true" or "false" by comparing two values. |
| Filter | Continues only if a comparison holds (equals, contains, regex, numbers, empty…). |
| Switch | Sends data to the first case equal to a value, one output per case, else to "else". |
| Wait For All | Continues once every incoming link has delivered, with their data merged. Force or Cancel from its settings. |
| Fan In | Collects firings into one `{{items}}` list with `{{itemCount}}`, released after a duration, a quiet period or a limit. Optionally one entry per key, e.g. `!join` sign-ups. |
| Fan Out | Runs what follows once per item of a list, e.g. a gift's recipients. |
| Portal Out | Sends the data through a Portal In, in this workflow or another, and the flow goes on from there. Its list has every Portal In, by workflow. **Wait for it to finish** gets back the data of the last node past the Portal In (or its failure), and gives the node an output. A loop going round more than 100 times in 10 seconds is stopped. |
| Delay | Waits before passing data on. |
| Cooldown | Lets data through, then sends the next to "blocked" for a while, for everyone and optionally per viewer. |
| Queue | Runs what follows one firing at a time; the next wait in line. Its settings show the line. |
| Word Filter | Masks the [bad words](./data#bad-words) in a key's text, or stops; adds `{{hasBadWords}}` and `{{badWordCount}}`. |
| Map Value | Replaces a key's value using a "from" → "to" list. |
| Edit Data | Adds or overwrites data keys, for this run only. |
| Edit Variable | Sets, adds to or deletes a [variable](./data#variables). |
| Code | Runs JavaScript on the data; its live column tests it on a recent input. |

## Actions

### Twitch

All need [Streamer mode](./twitch#guest-or-streamer).

| Node | What it does |
| --- | --- |
| Send Chat Message | Sends a message as the streamer, or a reply to one. |
| Announcement | Posts a chat announcement, highlighted in a color. |
| Shoutout | Gives another channel a shoutout (while live; one every 2 minutes). |
| Ban / Timeout | Times out, bans or unbans a viewer. |
| Delete Message | Deletes a chat message, e.g. the one that fired the trigger. |
| Create Clip | Clips the last moments of the stream and adds its URL as `{{clipUrl}}`. |
| User Info | Looks up a viewer: avatar, account age, follow age, sub tier, last category. |
| Channel Info | Gets a channel's stream, follower and sub counts, last clip or next scheduled stream. |
| Complete Redemption | Marks a redemption fulfilled, or refunds it (rewards made by Ovrly only). |
| Stream Marker | Adds a marker, to find the moment in the VOD. |
| Stream Info | Changes the title, category or tags. |
| Ad Break | Starts an ad break, or snoozes the next one by 5 minutes. |
| Chat Mode | Emote-only, followers-only, subscribers-only, slow or unique chat: on, off or toggled. |
| Channel Points Reward | Enables, disables, pauses or resumes a reward made by Ovrly (made the first time). |
| Raid | Raids another channel, or cancels the pending raid. |

### OBS, media, lights and system

| Node | What it does | Needs |
| --- | --- | --- |
| Switch Scene | Switches the OBS program scene, and back after a while if set. | [OBS](./obs) |
| Toggle Source | Shows, hides or toggles a source in an OBS scene. | [OBS](./obs) |
| GIPHY | Finds a GIF, sticker or clip and adds its URL as `{{giphyUrl}}`. | [Giphy](./hue-giphy#giphy) |
| MyInstants | Finds a sound on Myinstants and adds its URL as `{{sound}}`. | |
| Text-to-Speech | Speaks a text in a language and voice, and adds the sound as `{{sound}}`. | [Text-to-Speech](./hue-giphy#text-to-speech) |
| Hue Lights | Toggles, sets or turns off lights, or plays a routine of colors. | [Hue](./hue-giphy#philips-hue) |
| Key Press | Presses a key combo on this computer, optionally only while a given window is focused. | |
| HTTP Request | Sends an HTTP request, e.g. a Discord webhook. | |
| WebSocket Send | Opens a WebSocket, sends one message, then closes. | |

## Widgets

The **Widget** section of the library has every [widget type](./widgets).
