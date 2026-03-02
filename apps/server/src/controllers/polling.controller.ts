import { Request, Response } from 'express';
import { pollingEngine } from '../services/polling-engine.service';

export async function startAll(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    await pollingEngine.startAll(projectId);
    res.json({ success: true, message: 'All devices started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function stopAll(_req: Request, res: Response): Promise<void> {
  try {
    await pollingEngine.stopAll();
    res.json({ success: true, message: 'All devices stopped' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function startDevice(req: Request, res: Response): Promise<void> {
  try {
    await pollingEngine.startDevice(req.params.deviceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function stopDevice(req: Request, res: Response): Promise<void> {
  try {
    await pollingEngine.stopDevice(req.params.deviceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    res.json(pollingEngine.getStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    res.json(pollingEngine.getStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getErrorLog(_req: Request, res: Response): Promise<void> {
  try {
    res.json(pollingEngine.getErrorLog());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
