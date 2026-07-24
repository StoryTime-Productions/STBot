-- CreateTable
CREATE TABLE "PlaylistEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weekNumber" INTEGER NOT NULL,
    "person" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlaylistWeekStatus" (
    "weekNumber" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistEntry_weekNumber_person_key" ON "PlaylistEntry"("weekNumber", "person");
