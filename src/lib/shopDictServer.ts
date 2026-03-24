/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { shopDict, type ShopEntry } from "@/lib/shopDict";

type ShopDictionaryRow = RowDataPacket & {
  name_zh: string;
  name_ko: string | null;
  category: string | null;
  district: string | null;
};

export async function getShopDictFromDB(): Promise<ShopEntry[]> {
  try {
    const [rows] = (await pool.query(
      "SELECT name_zh, name_ko, category, district FROM shop_dictionary WHERE is_active = TRUE"
    )) as [ShopDictionaryRow[], unknown];

    if (rows.length === 0) return shopDict;

    return rows.map((row: ShopDictionaryRow) => ({
      zh: row.name_zh,
      koreanNames: (() => {
        try {
          return JSON.parse(row.name_ko || "[]");
        } catch {
          return [row.name_ko];
        }
      })() as string[],
      category: row.category ?? undefined,
      district: row.district ?? undefined,
    }));
  } catch {
    return shopDict;
  }
}
