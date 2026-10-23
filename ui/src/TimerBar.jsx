// Thin bar along the bottom of a self-hiding notification that shrinks to show the time left.
import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

export default function TimerBar({ ms }) {
  const ref = useRef()
  useEffect(() => {
    const a = animate(ref.current, { scaleX: [1, 0], duration: ms, ease: 'linear' })
    return () => a.cancel()
  }, [ms])
  return <div ref={ref} className="timer-bar" />
}
