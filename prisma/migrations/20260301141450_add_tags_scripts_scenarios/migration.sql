-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "data_type" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(30),
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "initial_value" VARCHAR(200),
    "current_value" VARCHAR(200),
    "sim_pattern" VARCHAR(20),
    "sim_frequency" DOUBLE PRECISION,
    "sim_amplitude" DOUBLE PRECISION,
    "sim_offset" DOUBLE PRECISION,
    "formula" TEXT,
    "group" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_scripts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" TEXT NOT NULL,
    "category" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_scenarios" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
