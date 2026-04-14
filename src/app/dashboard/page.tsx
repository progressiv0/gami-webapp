"use client";

import { Archive, CheckCircle, Clock, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  total: number;
  unsigned: number;
  signed: number;
  stamped: number;
  upgraded: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    {
      label: "Total GPRs",
      value: stats?.total ?? "—",
      icon: Archive,
      href: "/dashboard/gprs",
      color: "text-blue-600",
    },
    {
      label: "Unsigned",
      value: stats?.unsigned ?? "—",
      icon: FileQuestion,
      href: "/dashboard/gprs?status=unsigned",
      color: "text-yellow-600",
    },
    {
      label: "Pending OTS",
      value: stats?.stamped ?? "—",
      icon: Clock,
      href: "/dashboard/gprs?status=stamped",
      color: "text-orange-600",
    },
    {
      label: "Bitcoin Confirmed",
      value: stats?.upgraded ?? "—",
      icon: CheckCircle,
      href: "/dashboard/gprs?status=upgraded",
      color: "text-green-600",
    },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/dashboard/import" className="block text-primary hover:underline">
              → Import files / hashes
            </Link>
            <Link href="/dashboard/gprs?status=unsigned" className="block text-primary hover:underline">
              → Sign unsigned GPRs
            </Link>
            <Link href="/dashboard/gprs?status=signed" className="block text-primary hover:underline">
              → Stamp signed GPRs
            </Link>
            <Link href="/dashboard/gprs?status=stamped" className="block text-primary hover:underline">
              → Upgrade stamped GPRs
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
