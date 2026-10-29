# Templates

**New workflow** offers a blank canvas, an import (a workflow exported as JSON), and these templates. Each makes one workflow, switched off, with its widgets. Names in quotes (scenes, sources, rewards, the Discord webhook) and Hue lights are placeholders: set yours in the nodes' settings before turning it on.

![The New workflow dialog](/screenshots/new-workflow.png)

## Basic

| Template | What it does |
| --- | --- |
| Event alerts | Follows, subs, cheers and raids, each with its own text, shown one after another. |
| Last follower | Keeps the last follower on screen. |
| !roll dice | Chat rolls a die with `!roll`, once a minute per viewer; rolls wait their turn. |
| !sound soundboard | Chat plays a MyInstants sound with `!sound airhorn` (no word: a trending one). |
| !gif on screen | Chat shows a GIPHY GIF with `!gif cats` (no word: a trending one). Needs a [Giphy key](./hue-giphy#giphy). |

## Everyday stream tools

| Template | What it does |
| --- | --- |
| Chat reminders | Every 15 minutes while live, announces the next of three messages, in turn. |
| Death counter | [Control Pad](./stream-deck) buttons count deaths on screen; chat asks with `!deaths`. |
| !clip for VIPs | VIPs and mods clip the moment with `!clip`, marked in the VOD; the link goes to chat. |
| Raid welcome | A raid of 3 viewers or more gets a shoutout, an announcement and an alert. |
| Gift sub bomb | Thanks the gifter in chat and welcomes each recipient on screen, one after another. |
| BRB + ad break | A Control Pad button warns chat, then runs a 90 s ad on the "BRB" scene and switches back. |
| Going live | Going live sets the lights and posts the stream to a Discord webhook; ending turns the lights off. |

## Engagement and games

| Template | What it does |
| --- | --- |
| Chat poll | Mods start the poll with `!poll`; chat votes with `!vote 1` or `!vote yes`; the result is announced. |
| Channel points wheel | Redeeming "Spin the wheel" spins a wheel of challenges; spins wait their turn. |
| Twitch Plays | Chat plays the game: up, down, a, b… become key presses. Set the game window on Key Press. |

## Original

| Template | What it does |
| --- | --- |
| Bits chaos roulette | A 100+ bits cheer spins a slot of challenges; some toggle OBS sources for a minute. |
| Hype Train mood | A Hype Train pulses the lights and shows its level; its end celebrates in gold and in chat. |
| Link guard | Deletes links from viewers who have followed for less than a week, with a 60 s timeout. |

Many of them use Twitch features that need [Streamer mode](./twitch#guest-or-streamer): the nodes that need something not ready yet show a plug icon.
