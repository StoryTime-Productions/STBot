-- CreateTable
CREATE TABLE "PlaylistFrownFill" (
    "weekNumber" INTEGER NOT NULL,
    "person" TEXT NOT NULL,
    "filledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("weekNumber", "person")
);

