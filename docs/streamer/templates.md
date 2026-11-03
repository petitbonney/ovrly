# Templates

**New workflow** offers a blank canvas, an import (a workflow exported as JSON), and these templates. Each makes one workflow, switched off, with its widgets. Names in quotes (scenes, sources, rewards), the links in chat messages and Hue lights are placeholders: set yours in the nodes' settings before turning it on.

![The New workflow dialog](/screenshots/new-workflow.png)

## Essential

| Template | What it does |
| --- | --- |
| Event alerts | Follows, subs, cheers and raids, each with its own text and a sound, shown one after another. Pick the sound on the **Alert sound** widget. |
| Chat commands | Chat gets your links with `!socials` and `!discord`, once every 30 s; `!lurk` says goodbye, once per viewer. |
| Chat reminders | Every 15 minutes while live, announces the next of three messages, in turn. |
| Channel points media | Redeeming "Airhorn" plays an airhorn; redeeming "Show a GIF" shows a GIPHY GIF of what the viewer typed. Needs a [Giphy key](./hue-giphy#giphy). |

## Utility

| Template | What it does |
| --- | --- |
| Stream segments | [Control Pad](./stream-deck) buttons: "Starting soon" counts down 5 minutes, then switches to "Main"; BRB warns chat and runs a 90 s ad on the "BRB" scene, counting down; Ending shows the "Ending" scene and thanks chat. |
| Death counter | Control Pad buttons count deaths on screen, with the time since the last; chat asks with `!deaths`. |
| Raid & shoutout | A raid of 3 viewers or more gets a shoutout, an announcement and an alert; mods shout out anyone with `!so @name`. |
| Chat guard | Deletes bad words, and links from viewers who have followed for less than a week (with a 60 s timeout). |

## Advanced

| Template | What it does |
| --- | --- |
| Subathon | Control Pad buttons start and pause a 4-hour countdown; each sub adds 5 minutes, each 100 bits 1 minute. |
| Challenge wheel | Redeeming "Spin the wheel" spins a wheel of challenges; some run by themselves: the "Camera" source hides for a minute, the lights go off for a minute, an airhorn plays. Spins wait their turn. |
| Light show | Follows flash the lights and subs pulse them; a Hype Train pulses them and shows its level, its end celebrates in gold and in chat. |
| Cheer to speech | A 100+ bits cheer is read aloud, bad words bleeped, with an alert; cheers wait their turn. Needs the [voice model](./hue-giphy#text-to-speech). |
| Twitch Plays | Chat plays the game: up, down, a, b… become key presses. Every 5 minutes, anarchy (every command counts) and democracy (the most voted one) take turns, told in chat. Set the game window on Key Press. |
| Chat decides | Mods start a poll with `!poll`; chat votes with `!vote 1` or `!vote gaming`; the result is announced and the winning scene ("Chatting" or "Gaming") goes on. |

Many of them use Twitch features that need [Streamer mode](./twitch#guest-or-streamer): the nodes that need something not ready yet show a plug icon.
