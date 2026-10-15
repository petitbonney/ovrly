// Chat panels: Twitch channel setting and a test form that fires fake chat messages.
import { useEffect, useState } from 'react'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function Twitch() {
  const [status, setStatus] = useState({ channel: '', connected: false })
  const [channel, setChannel] = useState('')
  useEffect(() => {
    // Polled so the dot follows connect/disconnect without a WebSocket yet.
    const load = () => fetch('/api/twitch').then((r) => r.json()).then(setStatus)
    fetch('/api/twitch').then((r) => r.json()).then((s) => { setStatus(s); setChannel(s.channel) })
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setStatus(await (await fetch('/api/twitch', json('PUT', { channel }))).json())
  }

  return (
    <section>
      <h2>Twitch <span className={status.connected ? 'dot on' : 'dot'} title={status.connected ? 'Connected' : 'Disconnected'} /></h2>
      <form className="stack" onSubmit={save}>
        <input placeholder="channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
        <button>Connect</button>
      </form>
    </section>
  )
}

export function ChatTest() {
  const [user, setUser] = useState('tester')
  const [message, setMessage] = useState('!spin')

  const send = (e) => {
    e.preventDefault()
    fetch('/api/emit/chat', json('POST', { user, message, channel: 'test' }))
  }

  return (
    <section>
      <h2>Chat test</h2>
      <form className="stack" onSubmit={send}>
        <input placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <input placeholder="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button>Send</button>
      </form>
    </section>
  )
}
