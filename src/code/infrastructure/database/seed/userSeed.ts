import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
    await prisma.user.createMany({
        data: [
            {
                email: "user1@example.com",
                name: "User One",
                password: "password1",
                roles: "admin"
            },
            {
                email: "user2@example.com",
                name: "User Two",
                password: "password2",
                roles: "user"
            },
            {
                email: "user3@example.com",
                name: "User Three",
                password: "password3",
                roles: "admin"
            },
            {
                email: "user4@example.com",
                name: "User Four",
                password: "password4",
                roles: "user"
            },
            {
                email: "user5@example.com",
                name: "User Five",
                password: "password5",
                roles: "user"
            }
        ],
        skipDuplicates: true
    });
    console.log("User seed data created successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

  