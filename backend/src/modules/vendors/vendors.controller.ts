import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';
import { AuthenticatedRequest, VendorStatus, UserRole } from '../../types/index.js';
import { logAudit } from '../../utils/audit.js';

export async function listVendors(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, category } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { vendorCode: { contains: String(search) } },
        { contactPerson: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }
    if (status && Object.values(VendorStatus).includes(status as VendorStatus)) {
      where.status = status as string;
    }
    if (category) {
      where.categories = { contains: String(category) };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { vendors },
    });
  } catch (error) {
    next(error);
  }
}

export async function getVendorById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        quotations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      res.status(404).json({
        success: false,
        message: 'Vendor not found.',
      });
      return;
    }

    res.json({
      success: true,
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
}

export async function createVendor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, contactPerson, email, phone, address, categories, paymentTerms } = req.body;

    if (!name || !contactPerson || !email) {
      res.status(400).json({
        success: false,
        message: 'Vendor name, contact person, and email are required.',
      });
      return;
    }

    // Auto-generate vendor code if not provided
    const count = await prisma.vendor.count();
    const vendorCode = `VEN-${String(count + 1).padStart(3, '0')}`;

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode,
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        address: address?.trim() || '',
        categories: categories?.trim() || 'General Marine Supplies',
        paymentTerms: paymentTerms?.trim() || '30 Days',
        status: VendorStatus.ACTIVE,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'PROCUREMENT_OFFICER',
      action: 'CREATE_VENDOR',
      entityType: 'VENDOR',
      entityId: vendor.id,
      description: `Created vendor ${vendor.name} (${vendor.vendorCode}).`,
    });

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully.',
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVendor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, contactPerson, email, phone, address, categories, paymentTerms, status } = req.body;

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Vendor not found.',
      });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (contactPerson) updateData.contactPerson = contactPerson.trim();
    if (email) updateData.email = email.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (categories !== undefined) updateData.categories = categories.trim();
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms.trim();
    if (status && Object.values(VendorStatus).includes(status)) updateData.status = status;

    const updated = await prisma.vendor.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'PROCUREMENT_OFFICER',
      action: 'UPDATE_VENDOR',
      entityType: 'VENDOR',
      entityId: updated.id,
      description: `Updated vendor details for ${updated.name} (Status: ${updated.status}).`,
    });

    res.json({
      success: true,
      message: 'Vendor updated successfully.',
      data: { vendor: updated },
    });
  } catch (error) {
    next(error);
  }
}
