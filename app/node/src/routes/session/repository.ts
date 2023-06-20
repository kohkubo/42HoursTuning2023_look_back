import { RowDataPacket } from "mysql2";
import pool from "../../util/mysql";
import { Session } from "../../model/types";
import { convertDateToString } from "../../model/utils";

export const getSessionByUserId = async (
  userId: string
): Promise<Session | undefined> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT session_id, linked_user_id, created_at FROM session WHERE linked_user_id = ?",
    [userId]
  );

  if (rows.length === 0) {
    return;
  }

  const { session_id, linked_user_id, created_at } = rows[0];

  return {
    sessionId: session_id,
    userId: linked_user_id,
    createdAt: convertDateToString(created_at),
  };
};


export const createSession = async (
  sessionId: string,
  userId: string,
  now: Date
) => {
  await pool.query(
    "INSERT INTO session (session_id, linked_user_id, created_at) VALUES (?, ?, ?)",
    [sessionId, userId, now]
  );
};

export const getSessionBySessionId = async (
  sessionId: string
): Promise<Session | undefined> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT session_id, linked_user_id, created_at FROM session WHERE session_id = ?",
    [sessionId]
  );

  if (rows.length === 0) {
    return;
  }

  const { session_id, linked_user_id, created_at } = rows[0];

  return {
    sessionId: session_id,
    userId: linked_user_id,
    createdAt: convertDateToString(created_at),
  };
};


export const deleteSessions = async (userId: string) => {
  await pool.query("DELETE FROM session WHERE linked_user_id = ?", [userId]);
};
