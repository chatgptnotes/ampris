/**
 * Project Export / Import Controller
 * Allows downloading a complete project as JSON and importing it into another instance.
 */
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// ── Export ───────────────────────────────────────────────────────────────────

export async function exportProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Check access
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: req.user!.userId } },
    });
    if (!member) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        mimicPages: true,
        tags: true,
        tagScripts: true,
        testScenarios: true,
        externalDevices: true,
        recipes: true,
        reportTemplates: true,
        commandSequences: true,
        interlocks: true,
        sboConfigs: true,
        historianConfigs: true,
        trendConfigs: true,
        navigationLinks: true,
        customComponents: true,
        projectAlarmDefs: true,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Build export bundle — strip server-only fields, keep all config
    const bundle = {
      _format: 'gridvision-project-v1',
      _exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
        status: project.status,
        sldImage: project.sldImage,
        sldImageMime: project.sldImageMime,
      },
      mimicPages: project.mimicPages.map((p) => ({
        name: p.name,
        pageOrder: p.pageOrder,
        width: p.width,
        height: p.height,
        backgroundColor: p.backgroundColor,
        gridSize: p.gridSize,
        elements: p.elements,
        connections: p.connections,
        isHomePage: p.isHomePage,
      })),
      tags: project.tags.map((t) => ({
        name: t.name,
        description: t.description,
        type: t.type,
        dataType: t.dataType,
        unit: t.unit,
        minValue: t.minValue,
        maxValue: t.maxValue,
        initialValue: t.initialValue,
        simPattern: t.simPattern,
        simFrequency: t.simFrequency,
        simAmplitude: t.simAmplitude,
        simOffset: t.simOffset,
        formula: t.formula,
        group: t.group,
        metadata: t.metadata,
      })),
      tagScripts: project.tagScripts.map((s) => ({
        name: s.name,
        code: s.code,
        category: s.category,
      })),
      testScenarios: project.testScenarios.map((s) => ({
        name: s.name,
        steps: s.steps,
      })),
      recipes: project.recipes.map((r) => ({
        name: r.name,
        description: r.description,
        category: r.category,
        steps: r.steps,
        isActive: r.isActive,
      })),
      alarmDefinitions: project.projectAlarmDefs.map((a) => ({
        name: a.name,
        description: a.description,
        tagName: a.tagName,
        condition: a.condition,
        setpoint: a.setpoint,
        deadband: a.deadband,
        severity: a.severity,
        priority: a.priority,
        delay: a.delay,
        autoAck: a.autoAck,
        requiresComment: a.requiresComment,
        soundFile: a.soundFile,
        enabled: a.enabled,
      })),
      trendConfigs: project.trendConfigs.map((t) => ({
        name: t.name,
        description: t.description,
        pens: t.pens,
        timeRange: t.timeRange,
        refreshRate: t.refreshRate,
        showGrid: t.showGrid,
        showLegend: t.showLegend,
        yAxes: t.yAxes,
      })),
      commandSequences: project.commandSequences.map((c) => ({
        name: c.name,
        description: c.description,
        category: c.category,
        steps: c.steps,
        requiresAuth: c.requiresAuth,
        authorityLevel: c.authorityLevel,
        isEmergency: c.isEmergency,
      })),
      interlocks: project.interlocks.map((i) => ({
        name: i.name,
        description: i.description,
        targetTag: i.targetTag,
        targetAction: i.targetAction,
        targetValue: i.targetValue,
        conditions: i.conditions,
        enabled: i.enabled,
        priority: i.priority,
        bypassable: i.bypassable,
        bypassLevel: i.bypassLevel,
      })),
      sboConfigs: project.sboConfigs.map((s) => ({
        tagName: s.tagName,
        enabled: s.enabled,
        selectTimeout: s.selectTimeout,
        confirmRequired: s.confirmRequired,
        authorityLevel: s.authorityLevel,
      })),
      historianConfigs: project.historianConfigs.map((h) => ({
        tagName: h.tagName,
        enabled: h.enabled,
        compressionType: h.compressionType,
        deadband: h.deadband,
        deadbandPercent: h.deadbandPercent,
        slopeThreshold: h.slopeThreshold,
        maxInterval: h.maxInterval,
        minInterval: h.minInterval,
        retentionDays: h.retentionDays,
      })),
      navigationLinks: project.navigationLinks.map((n) => ({
        sourcePageId: n.sourcePageId,
        targetPageId: n.targetPageId,
        sourceElementId: n.sourceElementId,
        sourceArea: n.sourceArea,
        label: n.label,
        transitionType: n.transitionType,
        breadcrumbLabel: n.breadcrumbLabel,
      })),
      customComponents: project.customComponents.map((c) => ({
        name: c.name,
        description: c.description,
        category: c.category,
        svgCode: c.svgCode,
        width: c.width,
        height: c.height,
        tagBindings: c.tagBindings,
        properties: c.properties,
        thumbnail: c.thumbnail,
      })),
      // External devices (without credentials)
      externalDevices: project.externalDevices.map((d) => ({
        name: d.name,
        description: d.description,
        protocol: d.protocol,
        enabled: d.enabled,
        host: d.host,
        port: d.port,
        slaveId: d.slaveId,
        serialPort: d.serialPort,
        baudRate: d.baudRate,
        dataBits: d.dataBits,
        stopBits: d.stopBits,
        parity: d.parity,
        endpointUrl: d.endpointUrl,
        securityMode: d.securityMode,
        securityPolicy: d.securityPolicy,
        pollIntervalMs: d.pollIntervalMs,
        timeoutMs: d.timeoutMs,
        retryCount: d.retryCount,
      })),
    };

    // Safe filename
    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.gridvision.json"`);
    res.json(bundle);
  } catch (err: any) {
    console.error('[Project Export] Error:', err);
    res.status(500).json({ error: 'Failed to export project' });
  }
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importProject(req: Request, res: Response): Promise<void> {
  try {
    const bundle = req.body;

    // Validate format
    if (!bundle || bundle._format !== 'gridvision-project-v1') {
      res.status(400).json({ error: 'Invalid project file. Expected gridvision-project-v1 format.' });
      return;
    }

    const userId = req.user!.userId;
    const projectName = bundle.project?.name || 'Imported Project';

    // Create project with all related data in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create project
      const project = await tx.project.create({
        data: {
          name: projectName,
          description: bundle.project?.description || null,
          status: 'ACTIVE',
          sldImage: bundle.project?.sldImage || null,
          sldImageMime: bundle.project?.sldImageMime || null,
          ownerId: userId,
          members: {
            create: { userId, role: 'OWNER' },
          },
        },
      });

      // 2. Create mimic pages — track old page order → new page ID for navigation links
      const pageIdMap = new Map<string, string>(); // oldPageId → newPageId
      const pagesByOrder = new Map<number, string>(); // pageOrder → newPageId
      if (Array.isArray(bundle.mimicPages)) {
        for (const p of bundle.mimicPages) {
          const page = await tx.mimicPage.create({
            data: {
              projectId: project.id,
              name: p.name || 'Page',
              pageOrder: p.pageOrder ?? 0,
              width: p.width ?? 1920,
              height: p.height ?? 1080,
              backgroundColor: p.backgroundColor || '#FFFFFF',
              gridSize: p.gridSize ?? 20,
              elements: p.elements ?? [],
              connections: p.connections ?? [],
              isHomePage: p.isHomePage ?? false,
            },
          });
          pagesByOrder.set(p.pageOrder ?? 0, page.id);
        }
      }

      // 3. Create tags
      if (Array.isArray(bundle.tags)) {
        for (const t of bundle.tags) {
          await tx.tag.create({
            data: {
              projectId: project.id,
              name: t.name,
              description: t.description || null,
              type: t.type || 'SIMULATED',
              dataType: t.dataType || 'FLOAT',
              unit: t.unit || null,
              minValue: t.minValue ?? null,
              maxValue: t.maxValue ?? null,
              initialValue: t.initialValue || null,
              simPattern: t.simPattern || null,
              simFrequency: t.simFrequency ?? null,
              simAmplitude: t.simAmplitude ?? null,
              simOffset: t.simOffset ?? null,
              formula: t.formula || null,
              group: t.group || null,
              metadata: t.metadata ?? null,
            },
          });
        }
      }

      // 4. Tag scripts
      if (Array.isArray(bundle.tagScripts)) {
        for (const s of bundle.tagScripts) {
          await tx.tagScript.create({
            data: { projectId: project.id, name: s.name, code: s.code, category: s.category || null },
          });
        }
      }

      // 5. Test scenarios
      if (Array.isArray(bundle.testScenarios)) {
        for (const s of bundle.testScenarios) {
          await tx.testScenario.create({
            data: { projectId: project.id, name: s.name, steps: s.steps ?? [] },
          });
        }
      }

      // 6. Recipes
      if (Array.isArray(bundle.recipes)) {
        for (const r of bundle.recipes) {
          await tx.recipe.create({
            data: {
              projectId: project.id, name: r.name, description: r.description || null,
              category: r.category || null, steps: r.steps ?? [], isActive: r.isActive ?? false,
            },
          });
        }
      }

      // 7. Alarm definitions
      if (Array.isArray(bundle.alarmDefinitions)) {
        for (const a of bundle.alarmDefinitions) {
          await tx.projectAlarmDefinition.create({
            data: {
              projectId: project.id, name: a.name, description: a.description || null,
              tagName: a.tagName, condition: a.condition, setpoint: a.setpoint ?? null,
              deadband: a.deadband ?? 0, severity: a.severity ?? 2, priority: a.priority ?? 1,
              delay: a.delay ?? 0, autoAck: a.autoAck ?? false, requiresComment: a.requiresComment ?? false,
              soundFile: a.soundFile || null, enabled: a.enabled ?? true,
            },
          });
        }
      }

      // 8. Trend configs
      if (Array.isArray(bundle.trendConfigs)) {
        for (const t of bundle.trendConfigs) {
          await tx.trendConfig.create({
            data: {
              projectId: project.id, name: t.name, description: t.description || null,
              pens: t.pens, timeRange: t.timeRange ?? 3600, refreshRate: t.refreshRate ?? 1000,
              showGrid: t.showGrid ?? true, showLegend: t.showLegend ?? true, yAxes: t.yAxes ?? [],
            },
          });
        }
      }

      // 9. Command sequences
      if (Array.isArray(bundle.commandSequences)) {
        for (const c of bundle.commandSequences) {
          await tx.commandSequence.create({
            data: {
              projectId: project.id, name: c.name, description: c.description || null,
              category: c.category || null, steps: c.steps ?? [],
              requiresAuth: c.requiresAuth ?? true, authorityLevel: c.authorityLevel ?? 1,
              isEmergency: c.isEmergency ?? false,
            },
          });
        }
      }

      // 10. Interlocks
      if (Array.isArray(bundle.interlocks)) {
        for (const i of bundle.interlocks) {
          await tx.interlock.create({
            data: {
              projectId: project.id, name: i.name, description: i.description || null,
              targetTag: i.targetTag, targetAction: i.targetAction, targetValue: i.targetValue || null,
              conditions: i.conditions, enabled: i.enabled ?? true, priority: i.priority ?? 1,
              bypassable: i.bypassable ?? false, bypassLevel: i.bypassLevel ?? 3,
            },
          });
        }
      }

      // 11. SBO configs
      if (Array.isArray(bundle.sboConfigs)) {
        for (const s of bundle.sboConfigs) {
          await tx.sboConfig.create({
            data: {
              projectId: project.id, tagName: s.tagName, enabled: s.enabled ?? true,
              selectTimeout: s.selectTimeout ?? 30, confirmRequired: s.confirmRequired ?? true,
              authorityLevel: s.authorityLevel ?? 1,
            },
          });
        }
      }

      // 12. Historian configs
      if (Array.isArray(bundle.historianConfigs)) {
        for (const h of bundle.historianConfigs) {
          await tx.historianConfig.create({
            data: {
              projectId: project.id, tagName: h.tagName, enabled: h.enabled ?? true,
              compressionType: h.compressionType || 'none',
              deadband: h.deadband ?? 0, deadbandPercent: h.deadbandPercent ?? null,
              slopeThreshold: h.slopeThreshold ?? null, maxInterval: h.maxInterval ?? 3600,
              minInterval: h.minInterval ?? 0, retentionDays: h.retentionDays ?? 365,
            },
          });
        }
      }

      // 13. Custom components
      if (Array.isArray(bundle.customComponents)) {
        for (const c of bundle.customComponents) {
          await tx.customComponent.create({
            data: {
              projectId: project.id, name: c.name, description: c.description || null,
              category: c.category || 'Custom', svgCode: c.svgCode,
              width: c.width ?? 80, height: c.height ?? 60,
              tagBindings: c.tagBindings ?? null, properties: c.properties ?? null,
              thumbnail: c.thumbnail || null,
            },
          });
        }
      }

      // 14. External devices (no credentials)
      if (Array.isArray(bundle.externalDevices)) {
        for (const d of bundle.externalDevices) {
          await tx.externalDevice.create({
            data: {
              projectId: project.id, name: d.name, description: d.description || null,
              protocol: d.protocol, enabled: d.enabled ?? true,
              host: d.host || null, port: d.port ?? null, slaveId: d.slaveId ?? null,
              serialPort: d.serialPort || null, baudRate: d.baudRate ?? null,
              dataBits: d.dataBits ?? null, stopBits: d.stopBits ?? null, parity: d.parity || null,
              endpointUrl: d.endpointUrl || null, securityMode: d.securityMode || null,
              securityPolicy: d.securityPolicy || null,
              pollIntervalMs: d.pollIntervalMs ?? 1000, timeoutMs: d.timeoutMs ?? 5000,
              retryCount: d.retryCount ?? 3,
            },
          });
        }
      }

      return project;
    });

    res.status(201).json({
      id: result.id,
      name: result.name,
      message: 'Project imported successfully',
    });
  } catch (err: any) {
    console.error('[Project Import] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to import project' });
  }
}
