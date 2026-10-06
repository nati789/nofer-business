-- Additive change: existing events, clients, statuses and payments remain intact.
ALTER TABLE "Event" ADD COLUMN "preparationPlace" TEXT;
INSERT INTO "EventType" ("id", "name", "active")
VALUES ('nofer-bar-mitzvah', 'בר מצווה', true)
ON CONFLICT ("name") DO UPDATE SET "active" = true;
