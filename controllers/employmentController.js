const EmployeeRate = require('../models/EmployeeRate');
const Deduction = require('../models/Deduction');
const User = require('../models/User');
const Project = require('../models/Project');

// ============ EMPLOYEE RATE MANAGEMENT ============

/**
 * Create or update employee rate
 * Only admins/employers can set rates
 */
const setEmployeeRate = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { userId, hourlyRate, currency, rateType, projectId, effectiveFrom, notes } = req.body;

    // Verify the employee exists
    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // If projectId is provided, verify it exists
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
    }

    // Deactivate any existing active rates for this employee-employer-project combination
    await EmployeeRate.updateMany(
      {
        userId,
        employerId,
        projectId: projectId || { $exists: false },
        status: 'active'
      },
      {
        $set: {
          status: 'inactive',
          effectiveTo: new Date()
        }
      }
    );

    // Create new rate
    const newRate = new EmployeeRate({
      userId,
      employerId,
      teamId: employee.team,
      projectId,
      hourlyRate,
      currency: currency || 'NGN',
      rateType: rateType || 'hourly',
      effectiveFrom: effectiveFrom || new Date(),
      status: 'active',
      notes
    });

    await newRate.save();

    res.status(201).json({
      message: 'Employee rate set successfully',
      rate: newRate
    });

  } catch (err) {
    console.error('Error setting employee rate:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get employee rate
 * Can specify projectId for project-specific rates
 */
const getEmployeeRate = async (req, res) => {
  try {
    const { userId } = req.params;
    const { projectId, includeHistory } = req.query;

    const query = {
      userId,
      employerId: req.user.id
    };

    if (projectId) {
      query.projectId = projectId;
    }

    if (!includeHistory) {
      query.status = 'active';
    }

    const rates = await EmployeeRate.find(query)
      .populate('userId', 'full_name email')
      .populate('projectId', 'name')
      .sort({ effectiveFrom: -1 });

    if (rates.length === 0) {
      return res.status(404).json({ message: 'No rate found for this employee' });
    }

    res.status(200).json({
      rates: includeHistory ? rates : rates[0]
    });

  } catch (err) {
    console.error('Error fetching employee rate:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all employee rates for the employer
 */
const getAllEmployeeRates = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status } = req.query;

    const query = { employerId };
    if (status) {
      query.status = status;
    } else {
      query.status = 'active'; // Default to active only
    }

    const rates = await EmployeeRate.find(query)
      .populate('userId', 'full_name email')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ rates });

  } catch (err) {
    console.error('Error fetching all employee rates:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update employee rate (marks old as inactive and creates new one)
 */
const updateEmployeeRate = async (req, res) => {
  try {
    const { rateId } = req.params;
    const employerId = req.user.id;

    const existingRate = await EmployeeRate.findOne({ _id: rateId, employerId });
    if (!existingRate) {
      return res.status(404).json({ message: 'Rate not found' });
    }

    // Mark existing rate as inactive
    existingRate.status = 'inactive';
    existingRate.effectiveTo = new Date();
    await existingRate.save();

    // Create new rate with updated values
    const newRate = new EmployeeRate({
      userId: existingRate.userId,
      employerId: existingRate.employerId,
      teamId: existingRate.teamId,
      projectId: existingRate.projectId,
      ...req.body,
      effectiveFrom: req.body.effectiveFrom || new Date(),
      status: 'active'
    });

    await newRate.save();

    res.status(200).json({
      message: 'Employee rate updated successfully',
      rate: newRate
    });

  } catch (err) {
    console.error('Error updating employee rate:', err);
    res.status(500).json({ message: err.message });
  }
};

// ============ DEDUCTION MANAGEMENT ============

/**
 * Create deduction for an employee
 */
const createDeduction = async (req, res) => {
  try {
    const employerId = req.user.id;
    const {
      userId,
      name,
      deductionType,
      calculationType,
      value,
      priority,
      isPreTax,
      maxAmount,
      isRecurring,
      effectiveFrom,
      effectiveTo,
      description,
      targetAmount
    } = req.body;

    // Verify the employee exists
    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const newDeduction = new Deduction({
      userId,
      employerId,
      name,
      deductionType,
      calculationType,
      value,
      priority: priority || 0,
      isPreTax: isPreTax || false,
      maxAmount,
      isRecurring: isRecurring !== false, // Default to true
      effectiveFrom: effectiveFrom || new Date(),
      effectiveTo,
      description,
      targetAmount,
      status: 'active'
    });

    await newDeduction.save();

    res.status(201).json({
      message: 'Deduction created successfully',
      deduction: newDeduction
    });

  } catch (err) {
    console.error('Error creating deduction:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all deductions for an employee
 */
const getEmployeeDeductions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, includeInactive } = req.query;

    const query = {
      userId,
      employerId: req.user.id
    };

    if (status) {
      query.status = status;
    } else if (!includeInactive) {
      query.status = 'active';
    }

    const deductions = await Deduction.find(query)
      .populate('userId', 'full_name email')
      .sort({ priority: 1, createdAt: -1 });

    res.status(200).json({ deductions });

  } catch (err) {
    console.error('Error fetching employee deductions:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all deductions for the employer
 */
const getAllDeductions = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status } = req.query;

    const query = { employerId };
    if (status) {
      query.status = status;
    } else {
      query.status = 'active'; // Default to active only
    }

    const deductions = await Deduction.find(query)
      .populate('userId', 'full_name email')
      .sort({ priority: 1, createdAt: -1 });

    res.status(200).json({ deductions });

  } catch (err) {
    console.error('Error fetching all deductions:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update deduction
 */
const updateDeduction = async (req, res) => {
  try {
    const { deductionId } = req.params;
    const employerId = req.user.id;

    const deduction = await Deduction.findOne({ _id: deductionId, employerId });
    if (!deduction) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'value', 'priority', 'maxAmount', 'effectiveTo',
      'description', 'status', 'targetAmount'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        deduction[field] = req.body[field];
      }
    });

    await deduction.save();

    res.status(200).json({
      message: 'Deduction updated successfully',
      deduction
    });

  } catch (err) {
    console.error('Error updating deduction:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete/deactivate deduction
 */
const deleteDeduction = async (req, res) => {
  try {
    const { deductionId } = req.params;
    const employerId = req.user.id;

    const deduction = await Deduction.findOne({ _id: deductionId, employerId });
    if (!deduction) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    // Soft delete by marking as completed
    deduction.status = 'completed';
    deduction.effectiveTo = new Date();
    await deduction.save();

    res.status(200).json({
      message: 'Deduction deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting deduction:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  // Employee Rate endpoints
  setEmployeeRate,
  getEmployeeRate,
  getAllEmployeeRates,
  updateEmployeeRate,

  // Deduction endpoints
  createDeduction,
  getEmployeeDeductions,
  getAllDeductions,
  updateDeduction,
  deleteDeduction
};
