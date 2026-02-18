"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ModeToggle } from "@/components/mode-toggle"
import { Settings, Bell, Shield, Wifi, Database, Save, RefreshCw } from "lucide-react"

export default function IoTSettingsPage() {
  const [deviceSettings, setDeviceSettings] = useState({
    deviceName: "IoT Hub Controller",
    refreshInterval: "30",
    dataRetention: "90",
    apiEndpoint: "https://api.example.com/iot",
    apiKey: "••••••••••••••••",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    alertThreshold: "75",
    notificationEmail: "admin@example.com",
  })

  const [networkSettings, setNetworkSettings] = useState({
    mqttBroker: "mqtt://broker.example.com:1883",
    mqttUsername: "iot_user",
    mqttPassword: "••••••••",
    websocketPort: "8080",
  })

  const [saved, setSaved] = useState(false)

  const handleSaveSettings = () => {
    // Simulate saving settings
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleResetToDefaults = () => {
    if (confirm("Are you sure you want to reset all settings to default values?")) {
      setDeviceSettings({
        deviceName: "IoT Hub Controller",
        refreshInterval: "30",
        dataRetention: "90",
        apiEndpoint: "https://api.example.com/iot",
        apiKey: "••••••••••••••••",
      })
      setNotificationSettings({
        emailNotifications: true,
        pushNotifications: false,
        alertThreshold: "75",
        notificationEmail: "admin@example.com",
      })
      setNetworkSettings({
        mqttBroker: "mqtt://broker.example.com:1883",
        mqttUsername: "iot_user",
        mqttPassword: "••••••••",
        websocketPort: "8080",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">IoT Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/iot-dashboard">Dashboard</Link>
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
          <h2 className="text-3xl font-bold mb-2">System Settings</h2>
          <p className="text-muted-foreground">
            Configure your IoT Hub Controller settings and preferences
          </p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg flex items-center gap-2">
            <Save className="h-5 w-5" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Device Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Device Settings
              </CardTitle>
              <CardDescription>
                Configure general device and system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deviceName">Device Name</Label>
                  <Input
                    id="deviceName"
                    value={deviceSettings.deviceName}
                    onChange={(e) =>
                      setDeviceSettings({ ...deviceSettings, deviceName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    value={deviceSettings.refreshInterval}
                    onChange={(e) =>
                      setDeviceSettings({ ...deviceSettings, refreshInterval: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dataRetention">Data Retention (days)</Label>
                  <Input
                    id="dataRetention"
                    type="number"
                    value={deviceSettings.dataRetention}
                    onChange={(e) =>
                      setDeviceSettings({ ...deviceSettings, dataRetention: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="apiEndpoint">API Endpoint</Label>
                  <Input
                    id="apiEndpoint"
                    value={deviceSettings.apiEndpoint}
                    onChange={(e) =>
                      setDeviceSettings({ ...deviceSettings, apiEndpoint: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={deviceSettings.apiKey}
                  onChange={(e) =>
                    setDeviceSettings({ ...deviceSettings, apiKey: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Keep your API key secure and never share it publicly
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure alert and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="emailNotifications" className="cursor-pointer">
                    Enable Email Notifications
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    checked={notificationSettings.pushNotifications}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        pushNotifications: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="pushNotifications" className="cursor-pointer">
                    Enable Push Notifications
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="alertThreshold">Alert Threshold (%)</Label>
                  <Input
                    id="alertThreshold"
                    type="number"
                    min="0"
                    max="100"
                    value={notificationSettings.alertThreshold}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        alertThreshold: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Trigger alerts when metrics exceed this threshold
                  </p>
                </div>
                <div>
                  <Label htmlFor="notificationEmail">Notification Email</Label>
                  <Input
                    id="notificationEmail"
                    type="email"
                    value={notificationSettings.notificationEmail}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        notificationEmail: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Network & Connection Settings
              </CardTitle>
              <CardDescription>
                Configure MQTT broker and network connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mqttBroker">MQTT Broker URL</Label>
                  <Input
                    id="mqttBroker"
                    value={networkSettings.mqttBroker}
                    onChange={(e) =>
                      setNetworkSettings({ ...networkSettings, mqttBroker: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="websocketPort">WebSocket Port</Label>
                  <Input
                    id="websocketPort"
                    type="number"
                    value={networkSettings.websocketPort}
                    onChange={(e) =>
                      setNetworkSettings({ ...networkSettings, websocketPort: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mqttUsername">MQTT Username</Label>
                  <Input
                    id="mqttUsername"
                    value={networkSettings.mqttUsername}
                    onChange={(e) =>
                      setNetworkSettings({ ...networkSettings, mqttUsername: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="mqttPassword">MQTT Password</Label>
                  <Input
                    id="mqttPassword"
                    type="password"
                    value={networkSettings.mqttPassword}
                    onChange={(e) =>
                      setNetworkSettings({ ...networkSettings, mqttPassword: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enableSSL"
                    defaultChecked={true}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="enableSSL" className="cursor-pointer">
                    Enable SSL/TLS Encryption
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enableAuth"
                    defaultChecked={true}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="enableAuth" className="cursor-pointer">
                    Require Authentication for API Access
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enableLogging"
                    defaultChecked={true}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="enableLogging" className="cursor-pointer">
                    Enable Audit Logging
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Settings
              </CardTitle>
              <CardDescription>
                Configure database connection and storage settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="databaseUrl">Database URL</Label>
                <Input
                  id="databaseUrl"
                  type="password"
                  defaultValue="mongodb://localhost:27017/iothub"
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Database URL is configured via environment variables
                </p>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Database Status</h4>
                  <p className="text-sm text-muted-foreground">
                    Connected to MongoDB
                  </p>
                </div>
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSaveSettings} size="lg">
              <Save className="mr-2 h-4 w-4" />
              Save All Settings
            </Button>
            <Button onClick={handleResetToDefaults} variant="outline" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
