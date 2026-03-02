import { Request, Response } from 'express';
import { commDiagnosticsService } from '../services/comm-diagnostics.service';

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    res.json(commDiagnosticsService.getSummary(projectId ? String(projectId) : undefined));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDeviceStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = commDiagnosticsService.getDeviceStats(req.params.deviceId);
    res.json(stats || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDeviceLogs(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 100;
    res.json(commDiagnosticsService.getDeviceLogs(req.params.deviceId, limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDeviceTraffic(req: Request, res: Response): Promise<void> {
  try {
    res.json(commDiagnosticsService.getDeviceTraffic(req.params.deviceId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function pingDevice(req: Request, res: Response): Promise<void> {
  try {
    const result = await commDiagnosticsService.pingDevice(req.params.deviceId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetAll(_req: Request, res: Response): Promise<void> {
  try {
    commDiagnosticsService.resetAll();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getNetworkMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    res.json(commDiagnosticsService.getNetworkMap(String(projectId)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
