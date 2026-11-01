# Data and variables

## Data

When a trigger fires, it starts a **run** with some **data**: a Chat !command gives `user`, `message`, `command`, `args`…; a Follow gives `user`. Each node gets the data, may add to it or change it, and passes it on. The data is gone when the run ends.

- **Edit Data** adds or overwrites keys, e.g. `text` = `{{user}} just followed!`.
- **Map Value** swaps a key's value through a "from" → "to" list.
- **Word Filter** masks bad words, see below.
- A widget adds its result once it has stopped, e.g. the lottery's `{{winner}}`.

### Bad words

A **Word Filter** node checks a key's text (`message` by default) before a Text-to-Speech node reads it or a widget shows it. It masks each bad word (`f***`, `****` or a text of yours) or stops the run, and adds `{{censored}}` (true or false) and `{{badWords}}` (how many) for an If / Else after it, e.g. to time the viewer out.

- **Word lists**: pick as many languages as you like (28, from the [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) lists, CC BY 4.0); they're used together. Each is downloaded once, when the workflow is saved with it.
- **Extra words** adds your own, **Allowed words** keeps some unmasked: a word bad in one language can be ordinary in another (French *con* is Spanish for "with").

It ignores case and accents and sees through `sh1t`, `fuuuck` and `f.u.c.k`, but only takes whole words: *Scunthorpe* stays. Japanese, Thai and Chinese have no spaces between words, so theirs are found anywhere.

## Variables

**Variables** are shared by every workflow and kept across runs and restarts: a death counter, a score. Read them as `{{$vars.deaths}}`; change them with **Edit Variable** (set, add to, delete) or in **Settings → Variables**.

Ovrly keeps `{{$vars.channel}}` set to the channel in **Settings → Twitch**: the Guest channel, or yours once signed in in Streamer mode. A trigger fired by hand uses it as its user.

## Expressions

Any text setting takes `{{ ... }}`:

| You write | You get |
| --- | --- |
| `{{user}}` | a data key |
| `{{args.0}}` | the first word after the command |
| `{{json.items.0.name}}` | a path into nested data |
| `{{$vars.score}}` | a variable |
| `{{$node.http-request.status}}` | the output of an earlier node, by its type or id |
| `{{ score * 2 }}` | a JavaScript expression |

The **{ }** menu in a setting lists the keys the earlier nodes add.

::: danger Only import workflows you trust
Expressions and the Code node run as code on your computer.
:::

## When something fails

A node that fails stops its run there and turns red, with the error in its settings. A workflow starting with an **Error Trigger** runs whenever a node fails in another workflow: e.g. to post the error to Discord.
