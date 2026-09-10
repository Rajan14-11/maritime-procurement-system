import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, VesselStatus, UserRole } from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listVessels(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { imoNumber: { contains: String(search) } },
      ];
    }
    if (status && Object.values(VesselStatus).includes(status as VesselStatus)) {
      where.status = status as string;
    }

    const vessels = await prisma.vessel.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { vessels },
    });
  } catch (error) {
    next(error);
  }
}

export async function getVesselById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const vessel = await prisma.vessel.findUnique({
      where: { id },
    });

    if (!vessel) {
      res.status(404).json({
        success: false,
        message: 'Vessel not found.',
      });
      return;
    }

    res.json({
      success: true,
      data: { vessel },
    });
  } catch (error) {
    next(error);
  }
}

export async function createVessel(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, imoNumber, type, flag } = req.body;

    if (!name || !imoNumber || !type || !flag) {
      res.status(400).json({
        success: false,
        message: 'Vessel name, IMO number, vessel type, and flag are required.',
      });
      return;
    }

    const existing = await prisma.vessel.findUnique({
      where: { imoNumber: imoNumber.trim() },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `A vessel with IMO number ${imoNumber} already exists.`,
      });
      return;
    }

    const vessel = await prisma.vessel.create({
      data: {
        name: name.trim(),
        imoNumber: imoNumber.trim(),
        type: type.trim(),
        flag: flag.trim(),
        status: VesselStatus.ACTIVE,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'ADMIN',
      action: 'CREATE_VESSEL',
      entityType: 'VESSEL',
      entityId: vessel.id,
      description: `Registered vessel ${vessel.name} (IMO: ${vessel.imoNumber}, Type: ${vessel.type}).`,
    });

    res.status(201).json({
      success: true,
      message: 'Vessel created successfully.',
      data: { vessel },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVessel(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, type, flag, status } = req.body;

    const existing = await prisma.vessel.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Vessel not found.',
      });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (type) updateData.type = type.trim();
    if (flag) updateData.flag = flag.trim();
    if (status && Object.values(VesselStatus).includes(status)) updateData.status = status;

    const updated = await prisma.vessel.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'ADMIN',
      action: 'UPDATE_VESSEL',
      entityType: 'VESSEL',
      entityId: updated.id,
      description: `Updated vessel ${updated.name} (Status: ${updated.status}).`,
    });

    res.json({
      success: true,
      message: 'Vessel updated successfully.',
      data: { vessel: updated },
    });
  } catch (error) {
    next(error);
  }
}
