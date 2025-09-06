import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { HashPassword } from "../../utils/hash";
const prisma = new PrismaClient();
async function main() {
  await prisma.role.createMany({
    data: [
      {
        id: 1,
        nama_role: "mahasiswa",
        deskripsi: "Role untuk mahasiswa",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        nama_role: "dosen",
        deskripsi: "Role untuk dosen",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        nama_role: "pengelola",
        deskripsi: "Role untuk pengelola",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        nama_role: "superadmin",
        deskripsi: "Role untuk superadmin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  // Hash passwords and create users
  const users = [
    {
      uniqueId: "MHS-" + uuidv4(),
      email: "user1@example.com",
      nama: "User One",
      password: "password1",
      roleId: 1,
      NIM: "123456789",
      semester: "5",
    },
    {
      uniqueId: "DSN-" + uuidv4(),
      email: "user2@example.com",
      nama: "User Two",
      password: "password2",
      roleId: 2,
      NIP: "987654321",
    },
    {
      uniqueId: "PGL-" + uuidv4(),
      email: "user3@example.com",
      nama: "User Three",
      password: "password3",
      NIP: "192837465",
      roleId: 3,
    },
    {
      uniqueId: "ADM-" + uuidv4(),
      email: "user4@example.com",
      nama: "User Four",
      password: "password4",
      roleId: 4,
    },
    {
      uniqueId: "MHS-" + uuidv4(),
      email: "user5@example.com",
      nama: "User Five",
      password: "password5",
      roleId: 1,
      NIM: "123456790",
      semester: "3",
    }
  ];

  // Hash passwords and create users one by one
  for (const userData of users) {
    const hashedPassword = await HashPassword(userData.password);

    await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }

  console.log("User seed data created successfully with hashed passwords.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });