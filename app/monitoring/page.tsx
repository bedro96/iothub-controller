"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { LogOut, Activity, Database, Users, FileText } from "lucide-react"

type Stats = {
  users: number
  sessions: number
  devices: number
  auditLogs: number
}

type AuditLog = {
  id: string
  action: string
  userId?: string
  userEmail?: string
  ipAddress?: string
  createdAt: string
}

type LogEntry = {
  timestamp?: string
  level?: string
  message: string
}

export default function MonitoringPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logType, setLogType] = useState<'application' | 'error' | 'http'>('application')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchData = async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch("/api/monitoring", {
        method: "POST",
        credentials: "include",
      })
      
      if (statsResponse.ok) {
        const data = await statsResponse.json()
        setStats(data.stats)
        setAuditLogs(data.recentAuditLogs)
      } else if (statsResponse.status === 401 || statsResponse.status === 403) {
        router.push("/login")
        return
      }
      
      // Fetch logs
      const logsResponse = await fetch(`/api/monitoring?type=${logType}&lines=50`, {
        credentials: "include",
      })
      
      if (logsResponse.ok) {
        const data = await logsResponse.json()
        setLogs(data.logs)
      }
      
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logType])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => router.push("/admin")}>
              Admin Panel
            </Button>
            <ModeToggle />
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.users}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.sessions}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.devices}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.auditLogs}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Audit Logs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recent Audit Logs</CardTitle>
            <CardDescription>Latest system activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center p-2 border-b">
                  <div>
                    <span className="font-medium">{log.action}</span>
                    {log.userEmail && (
                      <span className="text-sm text-muted-foreground ml-2">
                        by {log.userEmail}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Log Viewer */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>Real-time application logs</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={logType === 'application' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogType('application')}
                >
                  Application
                </Button>
                <Button
                  variant={logType === 'error' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogType('error')}
                >
                  Errors
                </Button>
                <Button
                  variant={logType === 'http' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogType('http')}
                >
                  HTTP
                </Button>
                <Button size="sm" onClick={fetchData}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p>No logs available</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log.timestamp && (
                      <span className="text-gray-500">[{log.timestamp}]</span>
                    )}
                    {log.level && (
                      <span className={`ml-2 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        [{log.level.toUpperCase()}]
                      </span>
                    )}
                    <span className="ml-2">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
