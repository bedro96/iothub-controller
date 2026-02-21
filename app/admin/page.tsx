"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { LogOut, Settings, Users, Cpu, ChartSpline } from "lucide-react"

export default function AdminPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/")
  }

  const cards = [
    {
      title: "IoT Dashboard",
      description: "Monitor simulator devices at glance. View device status, recent activity, and performance metrics.",
      icon: ChartSpline,
      href: "/iot-dashboard",
    },
    {
      title: "IoT Settings",
      description: "Configure IoT device settings, network options, and notifications.",
      icon: Settings,
      href: "/iot-settings",
    },
    {
      title: "Simulator Control",
      description: "Manage and control IoT device simulators.",
      icon: Cpu,
      href: "/devices",
    },
    {
      title: "User Management",
      description: "View, create, update, and delete user accounts.",
      icon: Users,
      href: "/admin/usermanagement",
    },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-4">
            <ModeToggle />
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Card
                key={card.href}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(card.href)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle>{card.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
