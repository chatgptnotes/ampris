-- AlterTable: Add project_id to tags
ALTER TABLE "tags" ADD COLUMN "project_id" UUID NOT NULL;
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique constraint on name, add new composite unique
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_name_key";
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_name_key" UNIQUE ("project_id", "name");

-- AlterTable: Add project_id to tag_scripts
ALTER TABLE "tag_scripts" ADD COLUMN "project_id" UUID NOT NULL;
ALTER TABLE "tag_scripts" ADD CONSTRAINT "tag_scripts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add project_id to test_scenarios
ALTER TABLE "test_scenarios" ADD COLUMN "project_id" UUID NOT NULL;
ALTER TABLE "test_scenarios" ADD CONSTRAINT "test_scenarios_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
