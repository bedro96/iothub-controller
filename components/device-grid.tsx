"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Device = {
  id: string
  status: 'online' | 'warning' | 'offline' | 'maintenance'
  temperature: string
  humidity: string
  lastSeen: string
}

export default function DeviceGrid({ totalDevices = 1000 }: { totalDevices?: number }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [alerts, setAlerts] = useState<{ message: string; severity: string; time: Date }[]>([])

  const DEVICE_TYPES = useMemo(() => ['Sensor','Gateway','Controller','Actuator','Camera'], [])

  useEffect(() => {
    initDevices()
    const interval = setInterval(refreshDevices, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getRandomStatus() {
    const rand = Math.random()
    if (rand < 0.85) return 'online'
    if (rand < 0.92) return 'warning'
    if (rand < 0.97) return 'offline'
    return 'maintenance'
  }

  function initDevices() {
    const arr: Device[] = []
    for (let i = 0; i < totalDevices; i++) {
      arr.push({
        id: `DEV-${String(i + 1).padStart(4,'0')}`,
        status: getRandomStatus(),
        temperature: (20 + Math.random() * 15).toFixed(1),
        humidity: String(Math.floor(40 + Math.random() * 30)),
        lastSeen: new Date(Date.now() - Math.random() * 300000).toISOString(),
      })
    }
    setDevices(arr)
  }

  function refreshDevices() {
    setDevices(prev => {
      if (prev.length === 0) return prev
      const copy = [...prev]
      const updateCount = Math.max(1, Math.floor(totalDevices * 0.05))
      const indices = new Set<number>()
      while (indices.size < updateCount) indices.add(Math.floor(Math.random() * totalDevices))
      indices.forEach(i => {
        const old = copy[i]
        const newStatus = getRandomStatus()
        copy[i] = { ...old, status: newStatus, temperature: (20 + Math.random() * 15).toFixed(1), humidity: String(Math.floor(40 + Math.random() * 30)), lastSeen: new Date().toISOString() }
        if (old.status !== newStatus) {
          if (newStatus === 'offline') addAlert(`Device ${copy[i].id} went offline`, 'critical')
          if (newStatus === 'warning') addAlert(`Device ${copy[i].id} warning`, 'warning')
        }
      })
      return copy
    })
  }

  function addAlert(message: string, severity: string) {
    setAlerts(prev => {
      const next = [{ message, severity, time: new Date() }, ...prev]
      return next.slice(0, 10)
    })
  }

  const counts = useMemo(() => {
    const result = { online: 0, warning: 0, offline: 0, maintenance: 0 }
    devices.forEach(d => { result[d.status] = (result as any)[d.status] + 1 })
    return result
  }, [devices])

  const [showAlerts, setShowAlerts] = useState(false)

  return (
    <Card>
      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Device Grid</h3>
          <div className="text-xs text-muted-foreground">{totalDevices.toLocaleString()} Devices</div>
        </div>

        {/* Centered status counts */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-xs">
          <div className="px-2 py-1 rounded bg-green-600 text-white flex items-center gap-2"><span>Online</span><strong>{counts.online}</strong></div>
          <div className="px-2 py-1 rounded bg-yellow-500 text-white flex items-center gap-2"><span>Warning</span><strong>{counts.warning}</strong></div>
          <div className="px-2 py-1 rounded bg-red-600 text-white flex items-center gap-2"><span>Offline</span><strong>{counts.offline}</strong></div>
          <div className="px-2 py-1 rounded bg-gray-500 text-white flex items-center gap-2"><span>Maint</span><strong>{counts.maintenance}</strong></div>
        </div>

        {/* Right-aligned action buttons */}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setShowAlerts(true)}>{`Alerts (${alerts.length})`}</Button>
          <Button size="sm" variant="outline" onClick={() => setAlerts([])}>Clear</Button>
        </div>
      </CardHeader>

      {/* Compact body: only the grid (no aside) */}
      <CardContent className="p-2">
        <div
          className="device-grid bg-muted rounded"
          style={{ display: 'grid', gridTemplateColumns: `repeat(50, minmax(0,1fr))`, gap: '2px' }}
        >
          {devices.map((d, i) => (
            <div
              key={d.id}
              data-index={i}
              className={`device-pixel rounded-sm transform transition-transform duration-150 ease-in-out ${d.status === 'online' ? 'bg-green-500' : d.status === 'warning' ? 'bg-yellow-400 animate-pulse' : d.status === 'offline' ? 'bg-red-600' : 'bg-gray-500'}`}
              style={{ width: '100%', paddingBottom: '100%', position: 'relative' }}
              title={`${d.id} • ${d.status}`}
            />
          ))}
        </div>
      </CardContent>

      {/* Alerts overlay */}
      {showAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAlerts(false)} />
          <div className="relative w-full max-w-2xl bg-card p-4 rounded shadow-lg z-10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium">Alerts ({alerts.length})</h4>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAlerts([])}>Clear</Button>
                <Button size="sm" variant="default" onClick={() => setShowAlerts(false)}>Close</Button>
              </div>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto text-sm">
              {alerts.length === 0 && <div className="text-muted-foreground">No alerts</div>}
              {alerts.map((a, idx) => (
                <div key={idx} className={`p-2 rounded ${a.severity === 'critical' ? 'border-l-4 border-red-600' : a.severity === 'warning' ? 'border-l-4 border-yellow-400' : ''}`}>
                  <div className="flex justify-between">
                    <div>{a.message}</div>
                    <div className="text-muted-foreground text-xs">{a.time.toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
