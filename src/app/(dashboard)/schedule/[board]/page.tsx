import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ScheduleBoard } from "@/components/ScheduleBoard";

const boards = ["today", "upcoming", "catches"] as const;

type Params = Promise<{ board: string }>;

export default async function ScheduleBoardPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { board } = await params;
  if (!boards.includes(board as (typeof boards)[number])) notFound();
  return <ScheduleBoard board={board as (typeof boards)[number]} />;
}
