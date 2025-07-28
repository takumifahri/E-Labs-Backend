import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
async function main() {
    await prisma.user.createMany({
        data: [
          {
            uniqueId: "USR-" + uuidv4(),
            email: "user1@example.com",
            name: "User One",
            password: "password1",
            roles: "admin",
            createdAt: new Date(),
          },
          {
            uniqueId: "USR-" + uuidv4(),
            email: "user2@example.com",
            name: "User Two",
            password: "password2",
            roles: "user",
            createdAt: new Date(),
          },
          {
            uniqueId: "USR-" + uuidv4(),
            email: "user3@example.com",
            name: "User Three",
            password: "password3",
            roles: "admin",
            createdAt: new Date(),
          },
          {
            uniqueId: "USR-" + uuidv4(),
            email: "user4@example.com",
            name: "User Four",
            password: "password4",
            roles: "user",
            createdAt: new Date(),
          },
          {
            uniqueId: "USR-" + uuidv4(),
            email: "user5@example.com",
            name: "User Five",
            password: "password5",
            roles: "user",
            createdAt: new Date()
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