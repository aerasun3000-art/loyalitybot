import { useState, useEffect } from 'react'

const Toast = ({ message, type = 'error', duration = 4000, onClose }) => {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setExiting(true)
    }, duration - 200)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(hideTimer)
    }
  }, [duration, onClose])

  if (!visible) return null

  const bgColor = type === 'error'
    ? 'bg-red-500/90'
    : type === 'warning'
      ? 'bg-yellow-500/90'
      : 'bg-green-500/90'

  return (
    <div className={`fixed top-4 left-4 right-4 z-[200] ${bgColor} text-white rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm text-sm font-medium text-center ${exiting ? 'animate-slide-up' : 'animate-slide-down'}`}>
      {message}
    </div>
  )
}

export default Toast
