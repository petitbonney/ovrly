// Thin bar along the bottom of a self-hiding notification that shrinks to show the time left; calls onDone when empty.
import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

export default function TimerBar({ ms, paused, onDone }) {
  const ref = useRef()
  const anim = useRef()
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    anim.current = animate(ref.current, { scaleX: [1, 0], duration: ms, ease: 'linear', onComplete: () => done.current?.() })
    return () => anim.current.cancel()
  }, [ms])
  useEffect(() => { paused ? anim.current.pause() : anim.current.resume() }, [paused])
  return <div ref={ref} className="timer-bar" />
}
