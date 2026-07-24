-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HangoutEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'proposed',
    "when2meetUrl" TEXT,
    "lockedAt" TEXT,
    "logistics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "threadId" TEXT,
    "pingMessageId" TEXT,
    "lastPingedAt" DATETIME,
    "archived" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_HangoutEvent" ("createdAt", "id", "lockedAt", "logistics", "proposedBy", "stage", "title", "updatedAt", "when2meetUrl") SELECT "createdAt", "id", "lockedAt", "logistics", "proposedBy", "stage", "title", "updatedAt", "when2meetUrl" FROM "HangoutEvent";
DROP TABLE "HangoutEvent";
ALTER TABLE "new_HangoutEvent" RENAME TO "HangoutEvent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
