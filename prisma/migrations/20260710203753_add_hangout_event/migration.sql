-- CreateTable
CREATE TABLE "HangoutEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'proposed',
    "when2meetUrl" TEXT,
    "lockedAt" TEXT,
    "logistics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
