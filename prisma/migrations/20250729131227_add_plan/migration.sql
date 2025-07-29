-- CreateEnum
CREATE TYPE "StatusPlan" AS ENUM ('notyet', 'onprogres', 'completed');

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "forWhoUid" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "Start" TIMESTAMP(3) NOT NULL,
    "End" TIMESTAMP(3) NOT NULL,
    "NamePlan" TEXT NOT NULL,
    "Status" "StatusPlan" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_uniqueId_key" ON "Plan"("uniqueId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_forWhoUid_fkey" FOREIGN KEY ("forWhoUid") REFERENCES "User"("uniqueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("uniqueId") ON DELETE RESTRICT ON UPDATE CASCADE;
