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
    if (role && Object.values(UserRole).includes(role as UserRole)) {
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
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.',
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
        role: role as string,
        department: department?.trim() || null,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
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
      description: `Created user ${user.name} (${user.email}) with role ${user.role}.`,
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
    const { name, role, department, status, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (role && Object.values(UserRole).includes(role)) updateData.role = role;
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (status && Object.values(UserStatus).includes(status)) updateData.status = status;
    if (password && password.length >= 8) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
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
      description: `Updated user profile for ${updated.name} (Status: ${updated.status}, Role: ${updated.role}).`,
    });

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: { user: updated },
    });
  } catch (error) {
    next(error);
  }
}
