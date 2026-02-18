"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { Activity, Cpu, Signal, Thermometer, Gauge, TrendingUp, AlertTriangle } from "lucide-react"

type DeviceMetric = {
  id: string
  name: string
  status: "online" | "offline" | "warning"
  temperature: number
  cpu: number
  signal: number
  lastUpdate: string
}

export default function IoTDashboardPage() {
  const [devices, setDevices] = useState<DeviceMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching device data
    const mockDevices: DeviceMetric[] = [
      {
        id: "1",
        name: "Temperature Sensor - Living Room",
        status: "online",
        temperature: 22.5,
        cpu: 45,
        signal: 95,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Smart Thermostat - Bedroom",
        status: "online",
        temperature: 20.0,
        cpu: 32,
        signal: 88,
        lastUpdate: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      {
        id: "3",
        name: "Motion Sensor - Entrance",
        status: "warning",
        temperature: 23.8,
        cpu: 78,
        signal: 56,
        lastUpdate: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        id: "4",
        name: "Humidity Sensor - Bathroom",
        status: "online",
        temperature: 24.2,
        cpu: 41,
        signal: 92,
        lastUpdate: new Date(Date.now() - 2 * 60000).toISOString(),
      },
      {
        id: "5",
        name: "Air Quality Monitor - Kitchen",
        status: "offline",
        temperature: 0,
        cpu: 0,
        signal: 0,
        lastUpdate: new Date(Date.now() - 3600000).toISOString(),
      },
    ]

    setTimeout(() => {
      setDevices(mockDevices)
      setLoading(false)
    }, 500)
  }, [])

  const onlineDevices = devices.filter(d => d.status === "online").length
  const offlineDevices = devices.filter(d => d.status === "offline").length
  const warningDevices = devices.filter(d => d.status === "warning").length
  const avgTemperature = devices.filter(d => d.status !== "offline").reduce((acc, d) => acc + d.temperature, 0) / Math.max(devices.filter(d => d.status !== "offline").length, 1)
  const avgCpu = devices.filter(d => d.status !== "offline").reduce((acc, d) => acc + d.cpu, 0) / Math.max(devices.filter(d => d.status !== "offline").length, 1)

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
            Real-time monitoring of all connected IoT devices
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
                Connected devices
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

        {/* System Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                System Performance
              </CardTitle>
              <CardDescription>Average CPU usage across devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm text-muted-foreground">{avgCpu.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all" 
                      style={{ width: `${avgCpu}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  System is running optimally
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
              <CardDescription>Device activity in the last hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Data Points Received:</span>
                  <span className="font-medium">1,247</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Commands Sent:</span>
                  <span className="font-medium">89</span>
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

        {/* Device List */}
        <Card>
          <CardHeader>
            <CardTitle>Device Status</CardTitle>
            <CardDescription>Detailed view of all connected devices</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Temperature</div>
                        <div className="flex items-center justify-center gap-1">
                          <Thermometer className="h-4 w-4" />
                          <span className="font-semibold">{device.temperature}°C</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">CPU</div>
                        <div className="flex items-center justify-center gap-1">
                          <Cpu className="h-4 w-4" />
                          <span className="font-semibold">{device.cpu}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Signal</div>
                        <div className="flex items-center justify-center gap-1">
                          <Signal className="h-4 w-4" />
                          <span className="font-semibold">{device.signal}%</span>
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
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
