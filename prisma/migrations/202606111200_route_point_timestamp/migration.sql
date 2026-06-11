-- Add timestamp to route points for real encounter detection
ALTER TABLE "RunRoutePoint"
ADD COLUMN "timestamp" TIMESTAMP(3);

UPDATE "RunRoutePoint"
SET "timestamp" = NOW()
WHERE "timestamp" IS NULL;

ALTER TABLE "RunRoutePoint"
ALTER COLUMN "timestamp" SET NOT NULL;

CREATE INDEX "RunRoutePoint_runId_timestamp_idx" ON "RunRoutePoint"("runId", "timestamp");
