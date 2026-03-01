CREATE TABLE IF NOT EXISTS "tag_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL,
  "tag_name" VARCHAR(200) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "quality" VARCHAR(20),
  CONSTRAINT "tag_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tag_history_tag_name_timestamp_idx" ON "tag_history"("tag_name", "timestamp");

CREATE TABLE IF NOT EXISTS "ai_predictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "prediction_type" VARCHAR(50) NOT NULL,
  "target_entity" VARCHAR(200),
  "predicted_at" TIMESTAMPTZ NOT NULL,
  "forecast_time" TIMESTAMPTZ NOT NULL,
  "predicted_value" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "upper_bound" DOUBLE PRECISION,
  "lower_bound" DOUBLE PRECISION,
  "metadata" JSONB,
  CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_predictions_project_type_idx" ON "ai_predictions"("project_id", "prediction_type");

CREATE TABLE IF NOT EXISTS "equipment_health" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "equipment_name" VARCHAR(200) NOT NULL,
  "equipment_type" VARCHAR(50) NOT NULL,
  "health_score" DOUBLE PRECISION NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "anomalies" JSONB,
  "predictions" JSONB,
  "last_updated" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "equipment_health_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "equipment_health_project_idx" ON "equipment_health"("project_id");

CREATE TABLE IF NOT EXISTS "alarm_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "alarm_type" VARCHAR(100) NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "source" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "cleared_at" TIMESTAMPTZ,
  "duration" INTEGER,
  "metadata" JSONB,
  CONSTRAINT "alarm_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "alarm_events_project_timestamp_idx" ON "alarm_events"("project_id", "timestamp");
