-- Keep all client, event, payment and historical type records.
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
UPDATE "Client" SET "phone" = NULL WHERE TRIM("phone") = '';
ALTER TABLE "Event" ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
                    ADD COLUMN "venue" TEXT NOT NULL DEFAULT '';
-- Unstructured locations cannot reliably be split. Preserve the source verbatim.
UPDATE "Event" SET "venue" = "location";
UPDATE "EventType" SET "active" = false
WHERE "name" NOT IN ('חתונה', 'חינה', 'הפרשת חלה', 'ברית', 'צילומים');
INSERT INTO "EventType" ("id", "name", "active") VALUES
('nofer-wedding', 'חתונה', true), ('nofer-henna', 'חינה', true),
('nofer-challah', 'הפרשת חלה', true), ('nofer-brit', 'ברית', true),
('nofer-photo', 'צילומים', true)
ON CONFLICT ("name") DO UPDATE SET "active" = true;
