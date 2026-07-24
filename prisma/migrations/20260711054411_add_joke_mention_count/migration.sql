-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Joke" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "attributedTo" TEXT,
    "loggedBy" TEXT NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Joke" ("attributedTo", "createdAt", "id", "loggedBy", "text") SELECT "attributedTo", "createdAt", "id", "loggedBy", "text" FROM "Joke";
DROP TABLE "Joke";
ALTER TABLE "new_Joke" RENAME TO "Joke";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
