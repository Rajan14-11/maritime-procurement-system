import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, UserRole, UserStatus } from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, role, status } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }
    // Role-based scoping: Procurement Officers can only view Vendor user accounts
    if (req.user?.role === UserRole.PROCUREMENT_OFFICER) {
      where.role = UserRole.VENDOR;
    } else if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as string;
    }
    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      where.status = status as string;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        vesselId: true,
        vessel: true,
        vendorId: true,
        vendor: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        vesselId: true,
        vessel: true,
        vendorId: true,
        vendor: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    if (req.user?.role === UserRole.PROCUREMENT_OFFICER && user.role !== UserRole.VENDOR) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Procurement Officers are only authorized to view Vendor user accounts.',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, role, department, vesselId, vendorId } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.',
      });
      return;
    }

    if (req.user?.role === UserRole.PROCUREMENT_OFFICER && role !== UserRole.VENDOR) {
      res.status(403).json({
        success: false,
        message: 'Procurement Officers are only authorized to provision Vendor accounts.',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    if (vesselId && role === UserRole.REQUESTER) {
      const targetVessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
      if (!targetVessel) {
        res.status(400).json({ success: false, message: 'Assigned vessel not found.' });
        return;
      }
    }

    if (role === UserRole.VENDOR) {
      if (!vendorId) {
        res.status(400).json({ success: false, message: 'Vendor company selection is required for Vendor accounts.' });
        return;
      }
      const targetVendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
      if (!targetVendor) {
        res.status(400).json({ success: false, message: 'Assigned vendor company not found.' });
        return;
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: role as UserRole,
        department: department?.trim() || null,
        status: UserStatus.ACTIVE,
        vesselId: role === UserRole.REQUESTER ? (vesselId || null) : null,
        vendorId: role === UserRole.VENDOR ? (vendorId || null) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        vesselId: true,
        vessel: true,
        vendorId: true,
        vendor: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'ADMIN',
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: user.id,
      description: `Created user ${user.name} (${user.email}) with role ${user.role}.${user.vessel ? ` Assigned vessel: ${user.vessel.name}.` : ''}${user.vendor ? ` Assigned vendor: ${user.vendor.name}.` : ''}`,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, role, department, status, password, vesselId, vendorId } = req.body;

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { vessel: true, vendor: true },
    });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    if (req.user?.role === UserRole.PROCUREMENT_OFFICER && existing.role !== UserRole.VENDOR) {
      res.status(403).json({
        success: false,
        message: 'Procurement Officers can only manage Vendor accounts.',
      });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (role && Object.values(UserRole).includes(role)) {
      if (req.user?.role === UserRole.PROCUREMENT_OFFICER && role !== UserRole.VENDOR) {
        res.status(403).json({ success: false, message: 'Officers cannot change user role away from VENDOR.' });
        return;
      }
      updateData.role = role;
      if (role !== UserRole.REQUESTER) {
        updateData.vesselId = null;
      }
      if (role !== UserRole.VENDOR) {
        updateData.vendorId = null;
      }
    }
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (status && Object.values(UserStatus).includes(status)) updateData.status = status;
    if (password && password.length >= 8) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    let vesselChangeDesc = '';
    if (vesselId !== undefined) {
      const effectiveRole = updateData.role || existing.role;
      if (effectiveRole === UserRole.REQUESTER) {
        if (vesselId) {
          const newVessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
          if (!newVessel) {
            res.status(400).json({ success: false, message: 'Assigned vessel not found.' });
            return;
          }
          updateData.vesselId = vesselId;
          if (vesselId !== existing.vesselId) {
            vesselChangeDesc = ` Vessel assignment changed from ${existing.vessel?.name || 'None'} to ${newVessel.name}.`;
          }
        } else {
          updateData.vesselId = null;
          if (existing.vesselId) {
            vesselChangeDesc = ` Vessel assignment removed (previously ${existing.vessel?.name || 'None'}).`;
          }
        }
      } else {
        updateData.vesselId = null;
      }
    }

    let vendorChangeDesc = '';
    if (vendorId !== undefined) {
      const effectiveRole = updateData.role || existing.role;
      if (effectiveRole === UserRole.VENDOR) {
        if (vendorId) {
          const newVendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
          if (!newVendor) {
            res.status(400).json({ success: false, message: 'Assigned vendor company not found.' });
            return;
          }
          updateData.vendorId = vendorId;
          if (vendorId !== existing.vendorId) {
            vendorChangeDesc = ` Vendor assignment changed from ${existing.vendor?.name || 'None'} to ${newVendor.name}.`;
          }
        } else {
          updateData.vendorId = null;
          if (existing.vendorId) {
            vendorChangeDesc = ` Vendor assignment removed (previously ${existing.vendor?.name || 'None'}).`;
          }
        }
      } else {
        updateData.vendorId = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        vesselId: true,
        vessel: true,
        vendorId: true,
        vendor: true,
        updatedAt: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'ADMIN',
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: updated.id,
      description: `Updated user profile for ${updated.name} (Status: ${updated.status}, Role: ${updated.role}).${vesselChangeDesc}`,
    });

    if (vesselChangeDesc) {
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || 'Admin',
        userRole: req.user?.role || 'ADMIN',
        action: 'VESSEL_ASSIGNMENT_CHANGED',
        entityType: 'USER',
        entityId: updated.id,
        description: `Vessel assignment changed for ${updated.name}.${vesselChangeDesc}`,
        metadata: {
          previousVesselId: existing.vesselId,
          newVesselId: updated.vesselId,
        },
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: { user: updated },
    });
  } catch (error) {
    next(error);
  }
}
