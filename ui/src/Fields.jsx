// Settings form generated from a config's defaults, plus optional per-field hints from the node or widget type:
// { label, hint, unit, options, presets, vars, multiline, hidden, only, type: 'json' | 'code' | 'workflow' | 'secret' | 'var' | 'keys' | 'action' | 'input' | 'image' | 'widget' | 'window' }.
// presets: common values of a number, e.g. a duration's [3, 5, 10] seconds, shown as buttons next to its input.
// only: { key: value } shows the field only while those other settings have those values, e.g. { mode: 'twitch' }
// (or one of them: { layout: ['wheel', 'slots'] }). fixed: a list with a set number of items (no add, remove or move).
// An option { value, label, streamer: true } is a Twitch feature: it needs Twitch in Streamer mode (context.streamer).
// A list default with options gets one chip per option, any number picked (e.g. the kinds of subs a trigger fires on).
// Any other list default (e.g. a poll's options) gets a list editor (columns: { key: field } for its items' fields, e.g. a
// { type: 'keys' } picker), a color default ("#rrggbb") a color picker, and
// { obs: 'scenes' | 'sources' } suggestions from OBS.
import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Autocomplete, Button, Chip, ColorInput, Group, Image, JsonInput, Menu, NumberInput, PasswordInput, SegmentedControl,
  Select, Stack, Switch, TagsInput, Text, Textarea, TextInput, Tooltip,
} from '@mantine/core'
import { IconBraces, IconGripVertical, IconPlus, IconFolderOpen, IconX } from '@tabler/icons-react'
import { get } from './api.js'
import GiphyPicker from './GiphyPicker.jsx'
import MyinstantsPicker from './MyinstantsPicker.jsx'

// "case1" -> "Case1", "sceneName" -> "Scene name"
const humanize = (key) => key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)

// Suggestions filter: every option while the value is empty or one of them, else those containing it.
const suggest = ({ options, search }) => (!search || options.some((o) => o.value === search) ? options
  : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())))

// The "{}" button: a menu of the data keys available at this node; onPick(key) gets the one picked.
function VarMenu({ vars, onPick }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Insert data from previous nodes">
          <ActionIcon variant="subtle" size="sm"><IconBraces size={16} /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {vars.length ? vars.map((k) => <Menu.Item key={k} onClick={() => onPick(k)}>{`{{${k}}}`}</Menu.Item>)
          : <Menu.Label>Connect an input first</Menu.Label>}
      </Menu.Dropdown>
    </Menu>
  )
}

// Text input with a "{}" menu that inserts "{{key}}" placeholders at the cursor. With data, it also suggests those
// values as you type (see suggest).
function VarInput({ vars, value, onChange, multiline, data, ...props }) {
  const ref = useRef()
  const insert = (key) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    onChange(value.slice(0, start) + `{{${key}}}` + value.slice(el?.selectionEnd ?? start))
  }
  const menu = <VarMenu vars={vars} onPick={insert} />
  if (data) return <Autocomplete ref={ref} data={data} filter={suggest} value={value} onChange={onChange} rightSection={menu} {...props} />
  const Input = multiline ? Textarea : TextInput
  return <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rightSection={menu} autosize={multiline || undefined} minRows={multiline ? 2 : undefined} {...props} />
}

// A scene or source name, suggested from the OBS integration (the sources of the node's scene). Typing stays free,
// so it works with OBS closed, and with {{key}} placeholders.
function ObsInput({ list, scene, ...props }) {
  const [names, setNames] = useState([])
  const [error, setError] = useState('')
  const path = list === 'scenes' ? '/api/obs/scenes' : `/api/obs/sources?scene=${encodeURIComponent(scene)}`
  const skip = list === 'sources' && (!scene || scene.includes('{{'))
  useEffect(() => {
    if (skip) return setNames([])
    fetch(path).then(async (r) => {
      const body = await r.json()
      setNames(r.ok ? body : [])
      setError(r.ok ? '' : 'OBS is not connected: names can still be typed')
    }, () => setError('OBS is not reachable'))
  }, [path, skip])
  return <VarInput {...props} data={names} description={error || props.description} placeholder={names.length ? 'Pick or type a name' : undefined} />
}

// A saved workflow, picked by id.
function WorkflowSelect({ value, onChange, ...props }) {
  const [list, setList] = useState([])
  useEffect(() => {
    get('/api/workflows').then((all) => setList(all.map((w) => ({ value: w.id, label: w.name || w.id }))))
  }, [])
  return <Select {...props} data={list} value={value} onChange={onChange} placeholder="Pick a workflow" />
}

// An app or window (or part of its name), picked from those open now, listed again each time the list opens. Typing
// stays free.
function WindowInput({ onChange, ...props }) {
  const [names, setNames] = useState([])
  const load = () => fetch('/api/windows').then((r) => r.json()).then((list) => Array.isArray(list) && setNames(list), () => {})
  useEffect(() => {
    load()
  }, [])
  // Without the Accessibility permission (macOS), only app names come back.
  const titles = names.some((n) => n.includes(' — '))
  const description = titles || !names.length ? props.description : `${props.description}. Window titles need the Accessibility permission`
  return <Autocomplete {...props} description={description} data={names} filter={suggest} limit={100} onDropdownOpen={load}
    onChange={onChange} placeholder="Pick or type an app or window" />
}

// "90 s" -> "1m30", "300 s" -> "5m": presets read faster in minutes.
const short = (n, unit) => (unit === 's' && n >= 60 ? `${Math.floor(n / 60)}m${n % 60 ? String(n % 60).padStart(2, '0') : ''}` : `${n}${unit ?? ''}`)

// A number with preset buttons (the current one highlighted) and an input for any other value.
function PresetInput({ label, description, unit, presets, value, onChange }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Group gap={6} wrap="nowrap">
        {presets.map((n) => (
          <Button key={n} size="compact-xs" h={30} px="sm" variant={n === value ? 'filled' : 'default'} onClick={() => onChange(n)}>{short(n, unit)}</Button>
        ))}
        <NumberInput size="xs" w={90} min={0} aria-label={`Custom ${label.toLowerCase()}`} suffix={unit && ` ${unit}`} value={value} onChange={(v) => onChange(Number(v))} />
      </Group>
    </Stack>
  )
}

// An image: a preview, a button to pick a file on disk, a Giphy picker once the Giphy integration has a working key, and
// a field to paste a URL or path. The value is a file path on disk, a Giphy URL, or the pasted one.
function ImageInput({ label, description, value, onChange, vars }) {
  const [giphy, setGiphy] = useState(false) // whether Giphy is set up
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    get('/api/giphy').then((s) => setGiphy(s.connected), () => {})
  }, [])
  // The server opens the OS file dialog: a browser page can't see a picked file's path.
  const browse = async () => {
    const res = await fetch('/api/browse-image', { method: 'POST' })
    const body = await res.json()
    setError(res.ok ? '' : body.error)
    if (body.path) onChange(body.path)
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && !value.includes('{{') && <Image src={value.startsWith('/') && !value.startsWith('/media/') ? `/file?path=${encodeURIComponent(value)}` : value} alt="" h={90} fit="contain" radius="sm" bg="dark.6" />}
      <Group gap="xs">
        <Button size="xs" variant="default" leftSection={<IconFolderOpen size={14} />} onClick={browse}>Browse files</Button>
        <Tooltip label="Set up Giphy first (Integration → Giphy)" disabled={giphy}>
          <Button size="xs" variant="default" data-disabled={!giphy || undefined} onClick={() => giphy && setPicking(true)}>Giphy</Button>
        </Tooltip>
        {value && <Button size="xs" variant="subtle" color="red" onClick={() => onChange('')}>Clear</Button>}
      </Group>
      <VarInput size="xs" placeholder="or paste an image URL or file path" vars={vars} value={value} onChange={onChange} />
      {error && <Text size="xs" c="red">{error}</Text>}
      <GiphyPicker opened={picking} onClose={() => setPicking(false)} onPick={onChange} />
    </Stack>
  )
}

// A sound: a player, a button to pick a file on disk, a Myinstants search, and a field to paste a URL or path.
function SoundInput({ label, description, value, onChange, vars }) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const browse = async () => {
    const res = await fetch('/api/browse-sound', { method: 'POST' })
    const body = await res.json()
    setError(res.ok ? '' : body.error)
    if (body.path) onChange(body.path)
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {value && !value.includes('{{') && <audio controls style={{ width: '100%' }} src={value.startsWith('/') ? `/file?path=${encodeURIComponent(value)}` : value} />}
      <Group gap="xs">
        <Button size="xs" variant="default" leftSection={<IconFolderOpen size={14} />} onClick={browse}>Browse files</Button>
        <Button size="xs" variant="default" onClick={() => setPicking(true)}>Myinstants</Button>
        {value && <Button size="xs" variant="subtle" color="red" onClick={() => onChange('')}>Clear</Button>}
      </Group>
      <VarInput size="xs" placeholder="or paste a sound URL or file path" vars={vars} value={value} onChange={onChange} />
      {error && <Text size="xs" c="red">{error}</Text>}
      <MyinstantsPicker opened={picking} onClose={() => setPicking(false)} onPick={onChange} />
    </Stack>
  )
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const swatches = ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44']
// Column widths of list items with fields: colors and numbers are narrow, text takes the rest.
const width = (v) => (isColor(v) ? 110 : typeof v === 'number' ? 72 : undefined)

// One list item: a text, or an object edited field by field. shape (a default item) says which input each field gets,
// so a color being typed doesn't turn into a text field.
function ItemInput({ item, shape, columns = {}, onChange }) {
  if (typeof shape !== 'object') return <TextInput size="xs" flex={1} value={item} onChange={(e) => onChange(e.target.value)} />
  return Object.entries(shape).map(([key, example]) => {
    const props = { size: 'xs', w: width(example), flex: width(example) ? undefined : 1, 'aria-label': humanize(key) }
    const set = (v) => onChange({ ...item, [key]: v })
    if (columns[key]?.type === 'keys') {
      return <TagsInput key={key} {...props} miw={0} styles={{ inputField: { minWidth: 30 } }} data={columns[key].options}
        value={item[key] ? item[key].split('+') : []} onChange={(v) => set(v.join('+'))} />
    }
    if (isColor(example)) return <ColorInput key={key} {...props} swatches={swatches} value={item[key] ?? ''} onChange={set} />
    if (typeof example === 'number') return <NumberInput key={key} {...props} min={0} value={item[key]} onChange={(v) => set(Number(v))} />
    return <TextInput key={key} {...props} miw={0} value={item[key] ?? ''} onChange={(e) => set(e.target.value)} />
  })
}

// A list setting: one row per item, reordered by dragging its grip (dropped above the row it lands on) or removed,
// and an Add button. A new item is empty
// text, or shaped like the default items with empty text and, for colors, the first swatch not used yet.
function ListInput({ label, description, value, defaults, fixed, columns, onChange }) {
  const shape = defaults[0]
  const set = (i, item) => onChange(value.map((v, j) => (j === i ? item : v)))
  const [drag, setDrag] = useState(null) // { from, over }: the row being dragged and the row it is over
  const drop = () => {
    const next = value.filter((_, j) => j !== drag.from)
    next.splice(drag.over > drag.from ? drag.over - 1 : drag.over, 0, value[drag.from])
    onChange(next)
    setDrag(null)
  }
  const blank = () => {
    if (typeof shape !== 'object') return ''
    const used = value.flatMap((item) => Object.values(item))
    const fresh = swatches.find((c) => !used.includes(c)) ?? swatches[value.length % swatches.length]
    return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, isColor(v) ? fresh : typeof v === 'string' ? '' : v]))
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {typeof shape === 'object' && (
        // Column titles, as wide as the fields under them.
        <Group gap={6} wrap="nowrap" pl={28} pr={28}>
          {Object.entries(shape).map(([key, example]) => (
            <Text key={key} size="xs" c="dimmed" w={width(example)} flex={width(example) ? undefined : 1}>{humanize(key)}</Text>
          ))}
        </Group>
      )}
      {value.map((item, i) => (
        <Group
          key={i}
          gap={6}
          wrap="nowrap"
          // The drop spot shows as a line above the row (or below the last one).
          style={{ boxShadow: drag && drag.over === i && drag.from !== i ? '0 -2px 0 var(--mantine-color-blue-5)' : undefined }}
          onDragOver={(e) => {
            if (!drag) return
            e.preventDefault()
            const { top, height } = e.currentTarget.getBoundingClientRect()
            const over = e.clientY > top + height / 2 && i === value.length - 1 ? value.length : i
            if (over !== drag.over) setDrag({ ...drag, over })
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (drag) drop()
          }}
        >
          {!fixed && <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            style={{ cursor: 'grab' }}
            aria-label="Drag to reorder"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/ovrly-row', String(i)) // Firefox needs some data to drag
              e.dataTransfer.setDragImage(e.currentTarget.parentElement, 0, 0)
              setDrag({ from: i, over: i })
            }}
            onDragEnd={() => setDrag(null)}
          >
            <IconGripVertical size={14} />
          </ActionIcon>}
          <ItemInput item={item} shape={shape} columns={columns} onChange={(v) => set(i, v)} />
          {!fixed && <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><IconX size={14} /></ActionIcon>}
        </Group>
      ))}
      {drag?.over === value.length && <div style={{ height: 2, marginTop: -2, background: 'var(--mantine-color-blue-5)' }} />}
      {!fixed && (
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} fullWidth
          onClick={() => onChange([...value, blank()])}>
          Add
        </Button>
      )}
    </Stack>
  )
}

// One setting; context: { vars: data keys available here, widget: the node's widget, instances: the widgets to pick
// from, types } for the dynamic types.
function Field({ name, f, fallback, value, set, values, context }) {
  const props = { label: f.label ?? humanize(name), description: f.hint, size: 'xs' }
  if (Array.isArray(fallback) && f.options) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        <Chip.Group multiple value={value} onChange={set}>
          <Group gap={6}>{f.options.map((o) => <Chip key={o.value ?? o} value={o.value ?? o} size="xs">{o.label ?? o}</Chip>)}</Group>
        </Chip.Group>
      </Stack>
    )
  }
  if (Array.isArray(fallback)) return <ListInput label={props.label} description={props.description} value={value} defaults={fallback} fixed={f.fixed} columns={f.columns} onChange={set} />
  if (f.type === 'keys') {
    const tags = value ? value.split('+') : []
    return <TagsInput {...props} data={f.options} value={tags} onChange={(v) => set(v.join('+'))}
      rightSection={<VarMenu vars={context.vars ?? []} onPick={(k) => set([...tags, `{{${k}}}`].join('+'))} />} />
  }
  // A widget's actions come from its type (nothing to pick if there is only one); short option lists are buttons.
  const type = context.types?.find((t) => t.type === context.widget?.type)
  // A widget action's value is only asked for if the action takes one; the widget type says what it is: a hint, or
  // { type: 'image', hint } for an image picker.
  if (f.type === 'input') {
    const input = type?.inputs?.[values.action || type.main]
    if (input?.type === 'image') return <ImageInput {...props} label="Image" description={input.hint} vars={context.vars ?? []} value={value} onChange={set} />
    if (input?.type === 'sound') return <SoundInput {...props} label="Sound" description={input.hint} vars={context.vars ?? []} value={value} onChange={set} />
    return input ? <VarInput {...props} description={input} vars={context.vars ?? []} value={value} onChange={set} /> : null
  }
  // Twitch features can't be picked unless Streamer mode is on; one picked earlier says why it won't run.
  const options = f.type === 'action' ? type?.actions ?? [] : f.options?.map((o) => {
    if (!o.streamer) return o
    const { streamer, ...option } = o
    return { ...option, disabled: !context.streamer }
  })
  // A disabled Twitch feature says why on hover (segmented buttons only: a Select needs text labels).
  const explained = options?.map((o) => !o.disabled ? o : {
    ...o,
    label: <Tooltip label="Needs Twitch in Streamer mode, signed in (Integration → Twitch)" withinPortal><span>{o.label}</span></Tooltip>,
  })
  if (f.type === 'action' && options.length <= 1) return null
  if (f.options?.find((o) => o.value === value)?.streamer && !context.streamer) {
    props.description = <Text span size="xs" c="yellow">Needs Twitch in Streamer mode, signed in (Integration → Twitch)</Text>
  }
  if (options?.length <= 4) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        {/* A Widget Callback node with no action set runs its widget's main one. */}
        <SegmentedControl size="xs" data={explained} value={f.type === 'action' ? value || type.main : value} onChange={set} style={{ alignSelf: 'start' }} />
      </Stack>
    )
  }
  if (options) return <Select {...props} data={options} value={f.type === 'action' ? value || type.main : value} onChange={set} allowDeselect={false} />
  if (f.type === 'widget') {
    return <Select {...props} searchable data={context.instances ?? []} value={value || null} onChange={set} allowDeselect={false}
      placeholder="Search a widget" nothingFoundMessage="No widget node in this workflow" />
  }
  if (f.type === 'var') return <Autocomplete {...props} data={context.vars ?? []} value={value} onChange={set} />
  if (f.type === 'json') return <JsonInput {...props} value={value} onChange={set} validationError="Invalid JSON" formatOnBlur autosize minRows={2} />
  if (f.type === 'code') {
    return <Textarea {...props} value={value} onChange={(e) => set(e.target.value)} autosize minRows={4} spellCheck={false} styles={{ input: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }} />
  }
  if (f.type === 'workflow') return <WorkflowSelect {...props} value={value} onChange={set} />
  if (f.type === 'image') return <ImageInput {...props} value={value} onChange={set} />
  if (f.type === 'window') return <WindowInput {...props} value={value} onChange={set} />
  if (f.type === 'secret') return <PasswordInput {...props} value={value} onChange={(e) => set(e.target.value)} />
  if (isColor(fallback)) return <ColorInput {...props} swatches={swatches} value={value} onChange={set} />
  if (typeof fallback === 'boolean') return <Switch {...props} checked={value} onChange={(e) => set(e.target.checked)} />
  if (f.presets) return <PresetInput {...props} unit={f.unit} presets={f.presets} value={value} onChange={set} />
  if (typeof fallback === 'number') return <NumberInput {...props} suffix={f.unit && ` ${f.unit}`} value={value} onChange={(v) => set(Number(v))} />
  if (f.obs) return <ObsInput {...props} list={f.obs} scene={values.scene ?? ''} vars={context.vars ?? []} value={value} onChange={set} />
  if (f.vars) return <VarInput {...props} vars={context.vars ?? []} multiline={f.multiline} value={value} onChange={set} />
  return <TextInput {...props} value={value} onChange={(e) => set(e.target.value)} />
}

// show: the settings to show (all by default), e.g. to show some of them elsewhere in the pane.
export default function Fields({ defaults, values, onChange, fields = {}, context = {}, show = Object.keys(defaults) }) {
  const only = (f) => !f?.only || Object.entries(f.only).every(([k, v]) => [v].flat().includes(values[k] ?? defaults[k]))
  const keys = show.filter((key) => !fields[key]?.hidden && only(fields[key]))
  if (keys.length === 0) return <Text size="sm" c="dimmed">No settings</Text>
  return (
    <Stack gap="sm" maw={420}>
      {keys.map((key) => (
        <Field
          key={key}
          name={key}
          f={fields[key] ?? {}}
          fallback={defaults[key]}
          value={values[key] ?? defaults[key]}
          set={(v) => onChange({ ...values, [key]: v })}
          values={values}
          context={context}
        />
      ))}
    </Stack>
  )
}
