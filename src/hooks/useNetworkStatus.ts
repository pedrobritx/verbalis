import { useEffect, useState } from 'react'

function readOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState<boolean>(readOnline)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOnline(readOnline())
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
