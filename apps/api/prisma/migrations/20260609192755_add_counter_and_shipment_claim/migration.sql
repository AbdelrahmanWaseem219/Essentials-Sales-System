-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shipmentClaimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);
