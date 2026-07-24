import { db } from "./db.js";

export interface Joke {
  id: number;
  text: string;
  attributedTo: string | null;
  loggedBy: string;
  mentionCount: number;
}

export async function addJoke(
  text: string,
  loggedBy: string,
  attributedTo?: string
): Promise<Joke> {
  return db.joke.create({
    data: { text, loggedBy, attributedTo: attributedTo ?? null },
  });
}

export async function listJokes(limit = 10): Promise<Joke[]> {
  return db.joke.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function randomJoke(): Promise<Joke | null> {
  const count = await db.joke.count();
  if (count === 0) {
    return null;
  }

  const skip = Math.floor(Math.random() * count);
  const [joke] = await db.joke.findMany({ skip, take: 1 });
  return joke ?? null;
}

export class JokeNotFoundError extends Error {}

export async function incrementMention(id: number): Promise<Joke> {
  try {
    return await db.joke.update({
      where: { id },
      data: { mentionCount: { increment: 1 } },
    });
  } catch {
    throw new JokeNotFoundError(`No joke with id ${id}`);
  }
}
