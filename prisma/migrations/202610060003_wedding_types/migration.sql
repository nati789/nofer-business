-- Preserve historical wedding types and every linked event/payment.
UPDATE "EventType" SET "active" = false WHERE "name" = 'חתונה';
INSERT INTO "EventType" ("id", "name", "active") VALUES
('nofer-wedding-half-day', 'חתונה חצי יום', true),
('nofer-wedding-full-day', 'חתונה יום שלם', true)
ON CONFLICT ("name") DO UPDATE SET "active" = true;
