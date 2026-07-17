import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.drawHistory.deleteMany();
  await prisma.drawWinner.deleteMany();
  await prisma.drawSession.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.prize.deleteMany();
  await prisma.checkinPoint.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();

  // Create Event
  const event = await prisma.event.create({
    data: {
      name: "Tech Conference 2026",
      description:
        "Annual technology conference with workshops, talks, and networking",
      venue: "Bangkok Convention Center",
      startDate: new Date("2026-08-15T09:00:00Z"),
      endDate: new Date("2026-08-15T18:00:00Z"),
      status: "PUBLISHED",
      settings: {
        maxRegistrations: 500,
        allowGroupRegistration: true,
        maxGroupSize: 10,
        requireEmail: true,
      },
    },
  });

  console.log(`✅ Event created: ${event.name}`);

  // Create Checkin Points
  const checkinPoints = await Promise.all([
    prisma.checkinPoint.create({
      data: {
        eventId: event.id,
        name: "Main Entrance",
        location: "Hall A - Ground Floor",
        sortOrder: 1,
      },
    }),
    prisma.checkinPoint.create({
      data: {
        eventId: event.id,
        name: "VIP Lounge",
        location: "Hall B - 2nd Floor",
        sortOrder: 2,
      },
    }),
    prisma.checkinPoint.create({
      data: {
        eventId: event.id,
        name: "Workshop Room",
        location: "Room C301 - 3rd Floor",
        sortOrder: 3,
      },
    }),
  ]);

  console.log(`✅ ${checkinPoints.length} checkin points created`);

  // Create Prizes
  const prizes = await Promise.all([
    prisma.prize.create({
      data: {
        eventId: event.id,
        name: "MacBook Pro 16\"",
        description: "Apple MacBook Pro 16-inch M4 Pro",
        quantity: 1,
        sortOrder: 1,
        conditions: {
          mustCheckedIn: true,
          onePerPerson: true,
        },
      },
    }),
    prisma.prize.create({
      data: {
        eventId: event.id,
        name: "iPhone 17 Pro",
        description: "Apple iPhone 17 Pro 256GB",
        quantity: 3,
        sortOrder: 2,
        conditions: {
          mustCheckedIn: true,
          onePerPerson: true,
        },
      },
    }),
    prisma.prize.create({
      data: {
        eventId: event.id,
        name: "AirPods Pro",
        description: "Apple AirPods Pro (3rd Gen)",
        quantity: 10,
        sortOrder: 3,
        conditions: {
          mustCheckedIn: true,
          onePerPerson: true,
        },
      },
    }),
    prisma.prize.create({
      data: {
        eventId: event.id,
        name: "Gift Voucher 1,000 THB",
        description: "Central Gift Card worth 1,000 THB",
        quantity: 20,
        sortOrder: 4,
        conditions: {
          mustCheckedIn: true,
          onePerPerson: false,
        },
      },
    }),
  ]);

  console.log(`✅ ${prizes.length} prizes created`);

  // Create Registrations
  const departments = [
    "Engineering",
    "Marketing",
    "Sales",
    "HR",
    "Finance",
    "Operations",
  ];
  const employeeTypes = ["Full-time", "Part-time", "Contract", "Intern"];

  const registrations = [];
  for (let i = 1; i <= 50; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)]!;
    const empType =
      employeeTypes[Math.floor(Math.random() * employeeTypes.length)]!;
    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        fullName: `Attendee ${String(i).padStart(3, "0")}`,
        email: `attendee${i}@example.com`,
        phone: `08${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
        company: "Tech Corp",
        department: dept,
        employeeType: empType,
        qrCode: `EVT-${event.id.slice(0, 6)}-${String(i).padStart(4, "0")}`,
        status: "REGISTERED",
        metadata: { source: "seed" },
      },
    });
    registrations.push(reg);
  }

  console.log(`✅ ${registrations.length} registrations created`);

  // Create some group registrations
  const groupReg = registrations[0]!;
  await prisma.registration.update({
    where: { id: groupReg.id },
    data: { groupName: "Team Alpha", groupId: "group-alpha" },
  });

  await Promise.all([
    prisma.groupMember.create({
      data: {
        registrationId: groupReg.id,
        fullName: "Member A1",
        email: "a1@example.com",
        role: "leader",
      },
    }),
    prisma.groupMember.create({
      data: {
        registrationId: groupReg.id,
        fullName: "Member A2",
        email: "a2@example.com",
        role: "member",
      },
    }),
    prisma.groupMember.create({
      data: {
        registrationId: groupReg.id,
        fullName: "Member A3",
        email: "a3@example.com",
        role: "member",
      },
    }),
  ]);

  console.log("✅ Group registration with 3 members created");

  // Check-in first 30 people
  for (let i = 0; i < 30; i++) {
    const reg = registrations[i]!;
    await prisma.checkin.create({
      data: {
        registrationId: reg.id,
        checkinPointId: checkinPoints[0]!.id,
        method: "QR_SCAN",
      },
    });
    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: "CHECKED_IN" },
    });
  }

  console.log("✅ 30 attendees checked in");

  console.log("\n🎉 Seeding completed!");
  console.log(`   Event: ${event.name} (${event.id})`);
  console.log(`   Registrations: 50`);
  console.log(`   Checked-in: 30`);
  console.log(`   Prizes: ${prizes.length}`);
  console.log(`   Checkin Points: ${checkinPoints.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
