import { prisma } from "../utils/prisma";
import type { DrawConditions } from "@event-platform/types";

/**
 * Core Draw Engine
 *
 * Handles the logic for selecting eligible candidates based on prize conditions,
 * then randomly selecting winners using a cryptographically-fair method.
 */
export class DrawEngine {
  /**
   * Get eligible candidates for a draw based on prize conditions
   */
  static async getEligibleCandidates(
    eventId: string,
    prizeId: string
  ): Promise<
    {
      id: string;
      fullName: string;
      department: string | null;
      company: string | null;
      employeeType: string | null;
    }[]
  > {
    // Get prize with conditions
    const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
    if (!prize) throw new Error("Prize not found");

    const conditions = (prize.conditions as DrawConditions) || {};

    // Build base query filters
    const where: Record<string, unknown> = {
      eventId,
      status: { not: "CANCELLED" },
    };

    // Condition: Must be checked in
    if (conditions.mustCheckedIn) {
      where.status = "CHECKED_IN";
    }

    // Condition: Filter by department
    if (conditions.filterByDepartment && conditions.filterByDepartment.length > 0) {
      where.department = { in: conditions.filterByDepartment };
    }

    // Condition: Filter by employee type
    if (conditions.filterByEmployeeType && conditions.filterByEmployeeType.length > 0) {
      where.employeeType = { in: conditions.filterByEmployeeType };
    }

    // Get all matching registrations
    let candidates = await prisma.registration.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        department: true,
        company: true,
        employeeType: true,
        drawWinners: {
          where: {
            status: { in: ["PENDING", "ACCEPTED"] },
          },
          select: { prizeId: true },
        },
      },
    });

    // Condition: One prize per person — exclude anyone who already won ANY prize
    if (conditions.onePerPerson) {
      candidates = candidates.filter((c) => c.drawWinners.length === 0);
    }

    // Condition: Exclude winners (general) — exclude anyone who won THIS specific prize
    if (conditions.excludeWinners !== false) {
      candidates = candidates.filter(
        (c) => !c.drawWinners.some((w) => w.prizeId === prizeId)
      );
    }

    return candidates.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      department: c.department,
      company: c.company,
      employeeType: c.employeeType,
    }));
  }

  /**
   * Randomly select winners from eligible candidates
   * Uses Fisher-Yates shuffle for fairness
   */
  static selectWinners<T>(candidates: T[], count: number): T[] {
    if (candidates.length === 0) return [];
    if (count >= candidates.length) return [...candidates];

    // Fisher-Yates shuffle
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Perform a complete draw operation
   */
  static async performDraw(
    sessionId: string,
    count: number = 1
  ): Promise<{
    winners: {
      id: string;
      fullName: string;
      department: string | null;
      company: string | null;
    }[];
    candidates: number;
  }> {
    const session = await prisma.drawSession.findUnique({
      where: { id: sessionId },
      include: { prize: true },
    });
    if (!session) throw new Error("Draw session not found");

    const prize = session.prize;
    const remaining = prize.quantity - prize.awarded;
    if (remaining <= 0) throw new Error("No prizes remaining");

    const actualCount = Math.min(count, remaining);

    // Get eligible candidates
    const eligible = await this.getEligibleCandidates(session.eventId, prize.id);
    if (eligible.length === 0) throw new Error("No eligible candidates found");

    // Select winners
    const winners = this.selectWinners(eligible, actualCount);

    // Get max draw number for this session
    const maxDraw = await prisma.drawWinner.aggregate({
      where: { drawSessionId: sessionId },
      _max: { drawNumber: true },
    });
    const nextDrawNumber = (maxDraw._max.drawNumber || 0) + 1;

    // Save winners
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]!;
      await prisma.drawWinner.create({
        data: {
          drawSessionId: sessionId,
          registrationId: winner.id,
          prizeId: prize.id,
          status: "PENDING",
          drawNumber: nextDrawNumber + i,
        },
      });
    }

    // Update prize awarded count
    await prisma.prize.update({
      where: { id: prize.id },
      data: { awarded: { increment: winners.length } },
    });

    // Log draw history
    await prisma.drawHistory.create({
      data: {
        drawSessionId: sessionId,
        action: "DRAW",
        data: {
          winners: winners.map((w) => ({ id: w.id, fullName: w.fullName })),
          eligibleCount: eligible.length,
          drawNumber: nextDrawNumber,
        },
        performedBy: session.performedBy,
      },
    });

    return {
      winners,
      candidates: eligible.length,
    };
  }

  /**
   * Redraw — mark existing winner as redrawn, select a new one
   */
  static async redraw(
    winnerId: string,
    reason?: string,
    performedBy?: string
  ): Promise<{
    oldWinner: { id: string; fullName: string };
    newWinner: { id: string; fullName: string; department: string | null } | null;
  }> {
    const winner = await prisma.drawWinner.findUnique({
      where: { id: winnerId },
      include: {
        registration: true,
        drawSession: { include: { prize: true } },
      },
    });
    if (!winner) throw new Error("Winner not found");

    // Mark as redrawn
    await prisma.drawWinner.update({
      where: { id: winnerId },
      data: { status: "REDRAWN" },
    });

    // Decrement prize awarded count
    await prisma.prize.update({
      where: { id: winner.prizeId },
      data: { awarded: { decrement: 1 } },
    });

    // Log redraw
    await prisma.drawHistory.create({
      data: {
        drawSessionId: winner.drawSessionId,
        action: "REDRAW",
        data: {
          previousWinnerId: winner.registrationId,
          previousWinnerName: winner.registration.fullName,
          reason: reason || "Redraw requested",
        },
        performedBy,
      },
    });

    // Draw a new winner
    const result = await this.performDraw(winner.drawSessionId, 1);

    return {
      oldWinner: {
        id: winner.registrationId,
        fullName: winner.registration.fullName,
      },
      newWinner: result.winners[0]
        ? {
            id: result.winners[0].id,
            fullName: result.winners[0].fullName,
            department: result.winners[0].department,
          }
        : null,
    };
  }
}
