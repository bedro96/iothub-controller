"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { LogOut } from "lucide-react"

type User = {
  userId: string
  email: string
  role: string
}

function getUserFromSession(): Promise<User | null> {
  return fetch('/api/auth/me', { credentials: 'include' })
    .then(res => res.ok ? res.json().then(data => data.user) : null)
    .catch(() => null)
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    getUserFromSession().then(setUser)
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    setUser(null)
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">IoTHub Controller</h1>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    Welcome, {user.email}
                  </span>
                  <Button variant="outline" asChild>
                    <Link href="/devices">My Devices</Link>
                  </Button>
                  {user.role === "admin" && (
                    <>
                      <Button variant="outline" asChild>
                        <Link href="/admin">Admin Panel</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/monitoring">Monitoring</Link>
                      </Button>
                    </>
                  )}
                  <Button onClick={handleLogout} variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
              <ModeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h4 className="text-2xl font-bold mb-4">Welcome to IoTHub Controller</h4>
          {!user && (
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
            </div>
          )}
          {user && (
            <div className="mt-8">
              <ChartAreaInteractive />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
