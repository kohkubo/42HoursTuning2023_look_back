import { RowDataPacket, FieldPacket } from "mysql2";
import pool from "../../util/mysql";
import { File } from "../../model/types";

export const getFileByFileId = async (
  fileId: string
): Promise<File | undefined> => {
  const [rows]: [RowDataPacket[], FieldPacket[]] = await pool.query<RowDataPacket[]>(
    "SELECT file_name AS fileName, path FROM file WHERE file_id = ? LIMIT 1",
    [fileId]
  );
  return rows[0] ? rows[0] as File : undefined;
};
