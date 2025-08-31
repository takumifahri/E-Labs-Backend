import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
async function main() {
  await prisma.role.createMany({
    data: [
      {
        id: 1,
        roleName: "mahasiswa",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        roleName: "dosen",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        roleName: "pengelola",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        roleName: "superadmin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
  await prisma.user.createMany({
    data: [
      {
        uniqueId: "USR-" + uuidv4(),
        email: "user1@example.com",
        nama: "User One",
        password: "password1",
        roleId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        uniqueId: "USR-" + uuidv4(),
        email: "user2@example.com",
        nama: "User Two",
        password: "password2",
        roleId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        uniqueId: "USR-" + uuidv4(),
        email: "user3@example.com",
        nama: "User Three",
        password: "password3",
        roleId: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        uniqueId: "USR-" + uuidv4(),
        email: "user4@example.com",
        nama: "User Four",
        password: "password4",
        roleId: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        uniqueId: "USR-" + uuidv4(),
        email: "user5@example.com",
        nama: "User Five",
        password: "password5",
        roleId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]
  });
  console.log("User seed data created successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });