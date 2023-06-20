import { RowDataPacket } from "mysql2";
import NodeCache from 'node-cache';
import { MatchGroup, MatchGroupDetail, User } from "../../model/types";
import { convertToMatchGroupDetail } from "../../model/utils";
import pool from "../../util/mysql";
import { getUsersByUserIds } from "../users/repository";
const myCache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

export const hasSkillNameRecord = async (
  skillName: string
): Promise<boolean> => {
  const [[result]] = await pool.query<RowDataPacket[]>(
    "SELECT EXISTS(SELECT 1 FROM skill WHERE skill_name = ? LIMIT 1) as hasSkill",
    [skillName]
  );
  return Boolean(result.hasSkill);
};


export const getUserIdsBeforeMatched = async (
  userId: string
): Promise<string[]> => {
  const [userIdRows] = await pool.query<RowDataPacket[]>(
    `SELECT m2.user_id
     FROM match_group_member AS m1
     JOIN match_group_member AS m2 ON m1.match_group_id = m2.match_group_id
     WHERE m1.user_id = ? AND m2.user_id != ?`,
    [userId, userId]
  );

  return userIdRows.map((row) => row.user_id);
};


export const insertMatchGroup = async (matchGroupDetail: MatchGroupDetail) => {
  await pool.query<RowDataPacket[]>(
    "INSERT INTO match_group (match_group_id, match_group_name, description, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      matchGroupDetail.matchGroupId,
      matchGroupDetail.matchGroupName,
      matchGroupDetail.description,
      matchGroupDetail.status,
      matchGroupDetail.createdBy,
      matchGroupDetail.createdAt,
    ]
  );

  const promises = matchGroupDetail.members.map(member =>
    pool.query<RowDataPacket[]>(
      "INSERT INTO match_group_member (match_group_id, user_id) VALUES (?, ?)",
      [matchGroupDetail.matchGroupId, member.userId]
    )
  );

  await Promise.all(promises);
};


export const getMatchGroupDetailByMatchGroupId = async (
  matchGroupId: string,
  status?: string
): Promise<MatchGroupDetail | undefined> => {

  let matchGroupQuery =
    "SELECT mg.match_group_id, mg.match_group_name, mg.description, mg.status, mg.created_by, mg.created_at, mgm.user_id \
    FROM match_group as mg \
    LEFT JOIN match_group_member as mgm ON mg.match_group_id = mgm.match_group_id \
    WHERE mg.match_group_id = ?";

  if (status === "open") {
    matchGroupQuery += " AND mg.status = 'open'";
  }

  const [matchGroupRows] = await pool.query<RowDataPacket[]>(matchGroupQuery, [matchGroupId]);
  if (matchGroupRows.length === 0) {
    return;
  }

  const matchGroupMemberIds: string[] = matchGroupRows.map(
    (row: any) => row.user_id // if RowDataPacket doesn't have a user_id property, use 'any'
  );

  const searchedUsers = await getUsersByUserIds(matchGroupMemberIds); // if getUsersByUserIds doesn't support an additional fields parameter, remove it

  const members: User[] = searchedUsers;

  // Assuming matchGroupRows[0] is of a type that can be added new properties to
  const matchGroup = {...matchGroupRows[0], members: members};

  return convertToMatchGroupDetail(matchGroup as RowDataPacket); // if matchGroup isn't already a RowDataPacket, cast it
};



export const getMatchGroupIdsByUserId = async (
  userId: string
): Promise<string[]> => {
  const cacheKey = `matchGroupIds:${userId}`;

  // Try to get result from cache
  const cachedMatchGroupIds = myCache.get<string[]>(cacheKey);

  if (cachedMatchGroupIds) {
    return cachedMatchGroupIds;
  }

  const [matchGroupIds] = await pool.query<RowDataPacket[]>(
    "SELECT match_group_id FROM match_group_member WHERE user_id = ?",
    [userId]
  );

  const result = matchGroupIds.map((row) => row.match_group_id);

  // Store result in cache for future use
  myCache.set(cacheKey, result);

  return result;
};

export const getMatchGroupsByMatchGroupIds = async (
  matchGroupIds: string[],
  status: string
): Promise<MatchGroup[]> => {
  const fetchPromises = matchGroupIds.map(matchGroupId =>
    getMatchGroupDetailByMatchGroupId(matchGroupId, status)
  );

  const matchGroupDetails = await Promise.all(fetchPromises);

  const matchGroups = matchGroupDetails
    .filter((matchGroupDetail): matchGroupDetail is MatchGroupDetail => matchGroupDetail !== undefined)
    .map(({ description: _description, ...matchGroup }) => matchGroup);

  return matchGroups;
};
