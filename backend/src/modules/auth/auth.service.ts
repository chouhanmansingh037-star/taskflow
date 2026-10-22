import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { pool } from "../../db.js";
import { conflict, unauthorized } from "../../errors.js";

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

interface UserRow extends PublicUser {
  password_hash: string;
  token_version: number;
}

function issueToken(user: UserRow): string {
  return jwt.sign({ ver: user.token_version }, config.jwtSecret, {
    subject: user.id,
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

const toPublic = ({ id, email, name }: UserRow): PublicUser => ({ id, email, name });

export async function registerUser(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query<UserRow>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, password_hash, token_version",
      [input.email, input.name, passwordHash],
    );
    return { user: toPublic(rows[0]), token: issueToken(rows[0]) };
  } catch (err) {
    // 23505 = unique_violation on the case-insensitive email index.
    if ((err as { code?: string }).code === "23505") throw conflict("An account with this email already exists");
    throw err;
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const { rows } = await pool.query<UserRow>(
    "SELECT id, email, name, password_hash, token_version FROM users WHERE lower(email) = lower($1)",
    [input.email],
  );
  const user = rows[0];
  const passwordMatches = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordMatches) throw unauthorized("Invalid email or password");
  return { user: toPublic(user), token: issueToken(user) };
}

/** Invalidates every token issued so far for this user. */
export async function revokeSessions(userId: string): Promise<void> {
  await pool.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [userId]);
}
