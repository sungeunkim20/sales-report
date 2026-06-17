import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma generate는 DB 연결 없이 실행됨 — URL 검증은 런타임(src/lib/db.ts)에서 수행
// prisma migrate / db seed 등 실제 연결이 필요한 명령에서 DATABASE_URL이 없으면 Prisma가 에러를 냄
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
