"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { Activity, Signal, Thermometer, Gauge, TrendingUp, AlertTriangle, Droplets } from "lucide-react"
import dynamic from 'next/dynamic'

const DeviceGrid = dynamic(() => import('@/components/device-grid'), { ssr: false })

type TelemetryRecord = {
  id: string
  deviceId: string
  type: string | null
  modelId: string | null
  status: string | null
  temp: number | null
  humidity: number | null
  ts: string | null
  createdAt: string
}

type DeviceMetric = {
  id: string
  name: string
  status: "online" | "offline" | "warning"
  temperature: number
  humidity: number
  lastUpdate: string
}

/** Derive a DeviceMetric from the latest telemetry record for a device. */
function telemetryToMetric(record: TelemetryRecord): DeviceMetric {
  const deviceStatus = record.status?.toLowerCase() ?? ''
  const status: DeviceMetric["status"] =
    deviceStatus === "online" ? "online" :
    deviceStatus === "warning" ? "warning" : "offline"

  return {
    id: record.deviceId,
    name: record.deviceId,
    status,
    temperature: record.temp ?? 0,
    humidity: record.humidity ?? 0,
    lastUpdate: record.ts ?? record.createdAt,
  }
}

export default function IoTDashboardPage() {
  const [devices, setDevices] = useState<DeviceMetric[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry?limit=200')
      if (!res.ok) return
      const data: { telemetry: TelemetryRecord[] } = await res.json()
      setTelemetry(data.telemetry)

      // Build one DeviceMetric per device using the most recent record
      const latestByDevice = new Map<string, TelemetryRecord>()
      for (const record of data.telemetry) {
        if (!latestByDevice.has(record.deviceId)) {
          latestByDevice.set(record.deviceId, record)
        }
      }
      setDevices(Array.from(latestByDevice.values()).map(telemetryToMetric))
    } catch (err) {
      // Log fetch errors for debugging while keeping graceful degradation
      console.error('Failed to fetch telemetry:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTelemetry()
    // Refresh every 10 seconds to pick up new D2C messages
    const interval = setInterval(fetchTelemetry, 10000)
    return () => clearInterval(interval)
  }, [fetchTelemetry])

  const onlineDevices = devices.filter(d => d.status === "online").length
  const offlineDevices = devices.filter(d => d.status === "offline").length
  const warningDevices = devices.filter(d => d.status === "warning").length
  const activeDevices = devices.filter(d => d.status !== "offline")
  const avgTemperature = activeDevices.reduce((acc, d) => acc + d.temperature, 0) / Math.max(activeDevices.length, 1)
  const avgHumidity = activeDevices.reduce((acc, d) => acc + d.humidity, 0) / Math.max(activeDevices.length, 1)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "offline":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-pulse mx-auto mb-4" />
          <p className="text-lg">Loading IoT Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">IoT Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/iot-settings">Settings</Link>
              </Button>
              <ModeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Device Overview</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of all connected IoT devices (D2C telemetry)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{devices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Reporting devices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{onlineDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active devices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{warningDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <Signal className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{offlineDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Disconnected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Temp</CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgTemperature.toFixed(1)}°C</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all sensors
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Telemetry Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                Avg Humidity
              </CardTitle>
              <CardDescription>Average humidity across active devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Humidity</span>
                    <span className="text-sm text-muted-foreground">{avgHumidity.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(avgHumidity, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Activity Trend
              </CardTitle>
              <CardDescription>D2C messages received from devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Messages:</span>
                  <span className="font-medium">{telemetry.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unique Devices:</span>
                  <span className="font-medium">{devices.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Alerts Generated:</span>
                  <span className="font-medium">{warningDevices}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Last Update:</span>
                  <span className="font-medium">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Grid */}
        <div className="mb-8">
          <DeviceGrid totalDevices={1000} />
        </div>

        {/* Device List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Device Status</CardTitle>
            <CardDescription>Latest telemetry per device from IoT Hub D2C messages</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No telemetry received yet.</p>
            ) : (
              <div className="space-y-4">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 mb-4 md:mb-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{device.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(device.status)}`}>
                          {device.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(device.lastUpdate).toLocaleString()}
                      </p>
                    </div>

                    {device.status !== "offline" && (
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Temperature</div>
                          <div className="flex items-center justify-center gap-1">
                            <Thermometer className="h-4 w-4" />
                            <span className="font-semibold">{device.temperature.toFixed(1)}°C</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Humidity</div>
                          <div className="flex items-center justify-center gap-1">
                            <Droplets className="h-4 w-4" />
                            <span className="font-semibold">{device.humidity.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {device.status === "offline" && (
                      <div className="text-sm text-muted-foreground">
                        Device is currently offline
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Telemetry Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Recent D2C Messages</CardTitle>
            <CardDescription>Latest raw telemetry messages received from IoT Hub</CardDescription>
          </CardHeader>
          <CardContent>
            {telemetry.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages received yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left pb-2 pr-4">Device ID</th>
                      <th className="text-left pb-2 pr-4">Temp (°C)</th>
                      <th className="text-left pb-2 pr-4">Humidity (%)</th>
                      <th className="text-left pb-2 pr-4">Status</th>
                      <th className="text-left pb-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.slice(0, 20).map((record) => (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-mono text-xs">{record.deviceId}</td>
                        <td className="py-2 pr-4">{record.temp?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 pr-4">{record.humidity?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(record.status ?? '')}`}>
                            {record.status || '—'}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {record.ts ? new Date(record.ts).toLocaleString() : new Date(record.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
