-- Add device token environment and persistent ding requests
ALTER TABLE "DeviceToken"
ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'sandbox';

CREATE TABLE "DingRequest" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DingRequest_fromUserId_toUserId_key" ON "DingRequest"("fromUserId", "toUserId");
CREATE INDEX "DingRequest_toUserId_status_idx" ON "DingRequest"("toUserId", "status");
CREATE INDEX "DingRequest_fromUserId_status_idx" ON "DingRequest"("fromUserId", "status");

ALTER TABLE "DingRequest" ADD CONSTRAINT "DingRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DingRequest" ADD CONSTRAINT "DingRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
