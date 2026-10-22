-- Pierwsza migracja: SQL Prisma uzupełniony o CHECK, których nie wyraża schema.prisma.
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "users_role_check" CHECK ("role" IN ('STUDENT', 'ADMIN'))
);

CREATE TABLE "rooms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_number" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "rooms_capacity_check" CHECK (typeof("capacity") = 'integer' AND "capacity" > 0),
    CONSTRAINT "rooms_number_check" CHECK (length(trim("room_number")) > 0)
);

CREATE TABLE "bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "student_id" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "duration_slots" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" DATETIME,
    "cancelled_by_user_id" INTEGER,
    "cancel_reason" TEXT,
    CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "bookings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "bookings_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "bookings_status_check" CHECK ("status" IN ('ACTIVE', 'CANCELLED')),
    CONSTRAINT "bookings_reason_check" CHECK ("cancel_reason" IS NULL OR "cancel_reason" IN ('STUDENT_CANCELLED', 'ADMIN_CANCELLED', 'ROOM_DEACTIVATED', 'TIME_BLOCKED')),
    CONSTRAINT "bookings_cancellation_check" CHECK (
      ("status" = 'ACTIVE' AND "cancelled_at" IS NULL AND "cancelled_by_user_id" IS NULL AND "cancel_reason" IS NULL)
      OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL AND "cancel_reason" IS NOT NULL)
    ),
    CONSTRAINT "bookings_hours_check" CHECK (
      typeof("start_hour") = 'integer' AND "start_hour" BETWEEN 7 AND 22
      AND typeof("duration_slots") = 'integer' AND "duration_slots" IN (1, 2)
      AND "start_hour" + "duration_slots" <= 23
    )
);

CREATE TABLE "time_blocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "duration_slots" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_blocks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "time_blocks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "time_blocks_hours_check" CHECK (
      typeof("start_hour") = 'integer' AND "start_hour" BETWEEN 7 AND 22
      AND typeof("duration_slots") = 'integer' AND "duration_slots" IN (1, 2)
      AND "start_hour" + "duration_slots" <= 23
    )
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "rooms_room_number_key" ON "rooms"("room_number");
CREATE INDEX "bookings_room_id_date_idx" ON "bookings"("room_id", "date");
CREATE INDEX "bookings_student_id_date_idx" ON "bookings"("student_id", "date");
CREATE INDEX "time_blocks_room_id_date_idx" ON "time_blocks"("room_id", "date");
