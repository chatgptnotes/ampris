-- CreateTable
CREATE TABLE "substations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "location" VARCHAR(200),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "commissioned_at" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "substations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voltage_levels" (
    "id" UUID NOT NULL,
    "substation_id" UUID NOT NULL,
    "nominal_kv" DECIMAL(6,1) NOT NULL,
    "level_type" VARCHAR(10) NOT NULL,
    "bus_config" VARCHAR(30) NOT NULL DEFAULT 'SINGLE_BUS',

    CONSTRAINT "voltage_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bays" (
    "id" UUID NOT NULL,
    "voltage_level_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "bay_type" VARCHAR(20) NOT NULL,
    "bay_number" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "bay_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "tag" VARCHAR(80) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rated_voltage" DECIMAL(8,2),
    "rated_current" DECIMAL(8,2),
    "rated_mva" DECIMAL(8,2),
    "sld_x" INTEGER NOT NULL DEFAULT 0,
    "sld_y" INTEGER NOT NULL DEFAULT 0,
    "sld_rotation" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_points" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "tag" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "param_type" VARCHAR(10) NOT NULL,
    "unit" VARCHAR(20),
    "min_value" DECIMAL(12,4),
    "max_value" DECIMAL(12,4),
    "deadband" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "ied_connection_id" UUID,
    "register_address" INTEGER,
    "register_type" VARCHAR(20),
    "scale_factor" DECIMAL(10,6) NOT NULL DEFAULT 1.0,
    "offset_value" DECIMAL(10,4) NOT NULL DEFAULT 0,

    CONSTRAINT "data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ied_connections" (
    "id" UUID NOT NULL,
    "substation_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "protocol" VARCHAR(20) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "port" INTEGER NOT NULL,
    "slave_id" INTEGER,
    "polling_interval_ms" INTEGER NOT NULL DEFAULT 1000,
    "timeout_ms" INTEGER NOT NULL DEFAULT 5000,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "ied_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_definitions" (
    "id" UUID NOT NULL,
    "data_point_id" UUID NOT NULL,
    "alarm_type" VARCHAR(20) NOT NULL,
    "threshold" DECIMAL(12,4),
    "priority" SMALLINT NOT NULL,
    "message_template" VARCHAR(200) NOT NULL,
    "deadband" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "delay_ms" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "alarm_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_log" (
    "id" UUID NOT NULL,
    "alarm_def_id" UUID NOT NULL,
    "raised_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleared_at" TIMESTAMPTZ,
    "acked_at" TIMESTAMPTZ,
    "acked_by" UUID,
    "shelved_until" TIMESTAMPTZ,
    "value_at_raise" DOUBLE PRECISION,
    "priority" SMALLINT NOT NULL,
    "message" VARCHAR(300) NOT NULL,

    CONSTRAINT "alarm_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_commands" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "command_type" VARCHAR(20) NOT NULL,
    "sbo_state" VARCHAR(20) NOT NULL,
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "result_message" TEXT,

    CONSTRAINT "control_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "substations_code_key" ON "substations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tag_key" ON "equipment"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "data_points_tag_key" ON "data_points"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "voltage_levels" ADD CONSTRAINT "voltage_levels_substation_id_fkey" FOREIGN KEY ("substation_id") REFERENCES "substations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_voltage_level_id_fkey" FOREIGN KEY ("voltage_level_id") REFERENCES "voltage_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_ied_connection_id_fkey" FOREIGN KEY ("ied_connection_id") REFERENCES "ied_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ied_connections" ADD CONSTRAINT "ied_connections_substation_id_fkey" FOREIGN KEY ("substation_id") REFERENCES "substations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_definitions" ADD CONSTRAINT "alarm_definitions_data_point_id_fkey" FOREIGN KEY ("data_point_id") REFERENCES "data_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_log" ADD CONSTRAINT "alarm_log_alarm_def_id_fkey" FOREIGN KEY ("alarm_def_id") REFERENCES "alarm_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_log" ADD CONSTRAINT "alarm_log_acked_by_fkey" FOREIGN KEY ("acked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
