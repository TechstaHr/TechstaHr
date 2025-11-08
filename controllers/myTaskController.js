const MyTask = require('../models/MyTask');
const Notifications = require('../models/Notifications');
const Project = require('../models/Project');
const TaskTimeLog = require('../models/TaskTimeLog');
const User = require('../models/User');

const createMyTask = async (req, res) => {
  const {
    title,
    description,
    deadline,
    priority_tag,
    status,
    project: projectId,
    assignedTo: assignedToId,
    task_link,
    estimatedHours
  } = req.body;

  try {
    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    const project = await Project.findById(projectId).populate("teamMembers.user", "_id");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const requesterId = req.user.id;

    // Check if requester is allowed to create a task:
    // allow if requester is:
    //  - an admin,
    //  - the project creator,
    //  - OR is listed among the project's teamMembers (status doesn't matter).
    const isRequesterMember = project.teamMembers.some(
      (m) => m.user && m.user._id.toString() === requesterId
    );
    const isCreator = project.createdBy && project.createdBy.toString() === requesterId;
    const isAdmin = req.user.role === "admin";

    if (!isRequesterMember && !isCreator && !isAdmin) {
      return res
        .status(403)
        .json({ message: "You are not part of the project or project doesn't exist" });
    }

    // If an assignee is provided, ensure the assignee is part of the project (invited is fine)
    if (assignedToId) {
      const assignedIsCreator = project.createdBy && project.createdBy.toString() === assignedToId;
      const assignedIsMember = project.teamMembers.some(
        (m) => m.user && m.user._id.toString() === assignedToId
      );

      if (!assignedIsMember && !assignedIsCreator) {
        return res.status(400).json({
          message: "Assignee must be part of the project (they can be invited/pending)",
        });
      }
    }

    // Create the task (MyTask model assumed)
    const taskData = {
      title,
      description,
      deadline,
      priority_tag,
      status: status || "to_do",
      project: projectId,
      owner: requesterId,
      task_link,
      estimatedHours: estimatedHours || 0,
    };

    if (assignedToId) {
      taskData.assignedTo = assignedToId;
    }

    const newTask = await MyTask.create(taskData);

    // If you want to link the task into project.tasks virtuals are used; no manual push needed.
    // Optionally, notify assignee if assigned and notifications enabled (existing logic may handle it).

    return res.status(201).json({ message: "Task created", task: newTask });
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getAllTasks = async (req, res) => {
  try {
    const tasks = await MyTask.find()
      .populate({
        path: 'project',
        match: { team: req.user.team },
        select: 'name status'
      });

    const filteredTasks = tasks.filter(task => task.project);
    res.status(200).json(filteredTasks);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllTasksByUser = async (req, res) => {
  try {
    const tasks = await MyTask.find({ owner: req.user.id })
      .populate({
        path: 'project',
        match: { team: req.user.team },
        select: 'name status'
      });

    const filteredTasks = tasks.filter(task => task.project);
    res.status(200).json(filteredTasks);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await MyTask.findById(req.params.id).populate({
      path: 'project',
      select: 'name team'
    });

    if (!task || !task.project) {
      return res.status(404).json({ message: "Task not found or project missing" });
    }

    const isOwner = task.owner.toString() === req.user.id;
    const isAdminOfSameTeam = req.user.role === 'admin' && task.project.team.toString() === req.user.team;

    if (!isOwner && !isAdminOfSameTeam) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Error fetching task:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await MyTask.findById(req.params.id).populate('project', 'team name');

    if (!task || !task.project) {
      return res.status(404).json({ message: "Task not found or access denied" });
    }

    const isOwner = task.owner.toString() === req.user.id;
    const isTeamAdmin = req.user.role === 'admin' && task.project.team.toString() === req.user.team.toString();

    if (!isOwner && !isTeamAdmin) {
      return res.status(403).json({ message: "You are not authorized to update this task" });
    }

    Object.assign(task, req.body);
    await task.save();

    const adminUsers = await User.find({ team: req.user.team, role: "admin" });
    const notifications = adminUsers.map(admin => ({
      recipient: admin._id,
      type: "task_updated",
      message: `${req.user.full_name} updated the task "${task.title}" in project "${task.project.name}".`,
      link: `/projects/${task.project._id}/tasks/${task._id}`
    }));
    await Notifications.insertMany(notifications);

    const populatedTask = await MyTask.findById(task._id).populate('project', 'name');
    res.status(200).json(populatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await MyTask.findOne({ _id: req.params.id, owner: req.user.id }).populate('project', 'team name');

    if (!task || task.project.team.toString() !== req.user.team.toString()) {
      return res.status(403).json({ message: "Task not found or access denied" });
    }

    await MyTask.deleteOne({ _id: req.params.id });

    const adminUsers = await User.find({ team: req.user.team, role: "admin" });
    const notifications = adminUsers.map(admin => ({
      recipient: admin._id,
      type: "task_deleted",
      message: `${req.user.full_name} deleted the task "${task.title}" from project "${task.project.name}".`,
      link: `/projects/${task.project._id}/tasks`
    }));
    await Notifications.insertMany(notifications);

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const startTaskTimer = async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    const task = await MyTask.findOne({ _id: taskId, owner: userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found or access denied" });
    }

    const existing = await TaskTimeLog.findOne({ task: taskId, user: userId, endTime: null });
    if (existing) {
      return res.status(400).json({ message: "Timer already running for this task" });
    }

    const log = await TaskTimeLog.create({
      task: taskId,
      user: userId,
      startTime: new Date()
    });

    res.status(201).json({ message: "Task timer started", log });
  } catch (err) {
    console.error("Start task timer error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const stopTaskTimer = async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    const task = await MyTask.findOne({ _id: taskId, owner: userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found or access denied" });
    }

    const log = await TaskTimeLog.findOne({ task: taskId, user: userId, endTime: null });
    if (!log) {
      return res.status(404).json({ message: "No active timer found for this task" });
    }

    const endTime = new Date();
    const duration = Math.round((endTime - log.startTime) / 60000);

    log.endTime = endTime;
    log.durationMinutes = duration;
    await log.save();

    res.json({ message: "Task timer stopped", log });
  } catch (err) {
    console.error("Stop task timer error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getDailyTaskTimesheet = async (req, res) => {
  const userId = req.user.id;
  const { date } = req.query;

  try {
    const now = new Date();
    let inputDate = date
      ? new Date(...date.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))))
      : now;

    const targetDate = new Date(inputDate.setHours(0, 0, 0, 0));
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const logs = await TaskTimeLog.find({
      user: userId,
      startTime: { $gte: targetDate, $lt: nextDay }
    })
      .populate({
        path: "task",
        select: "title project",
        populate: { path: "project", select: "name team" }
      });

    const timesheet = {};

    for (const log of logs) {
      if (!log.task) continue;

      const taskId = log.task._id.toString();
      if (!timesheet[taskId]) {
        timesheet[taskId] = {
          taskTitle: log.task.title,
          projectName: log.task.project?.name,
          logs: []
        };
      }

      timesheet[taskId].logs.push({
        logId: log._id,
        start: log.startTime,
        end: log.endTime,
        isRunning: !log.endTime,
        link: `/dashboard/team/task-timesheet/${log._id}`
      });
    }

    res.json({
      date: targetDate.toISOString().split("T")[0],
      timesheet,
      message: "Task daily timesheet fetched successfully",
      queryDate: date || now.toISOString().split("T")[0]
    });
  } catch (err) {
    console.error("Get task timesheet error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const submitTaskTimesheet = async (req, res) => {
  const { timeLogId } = req.body;

  try {
    const log = await TaskTimeLog.findOne({ _id: timeLogId, user: req.user.id });
    if (!log) {
      return res.status(404).json({ message: "Task log not found" });
    }

    log.submitted = true;
    log.submittedAt = new Date();
    await log.save();

    res.json({ message: "Task timesheet submitted successfully" });
  } catch (err) {
    console.error("Submit task timesheet error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSubmittedTaskTimesheets = async (req, res) => {
  try {
    const logs = await TaskTimeLog.find({ submitted: true })
      .populate("user", "full_name email")
      .populate({
        path: "task",
        select: "title project",
        populate: { path: "project", select: "name" }
      });

    const data = logs.map(log => ({
      logId: log._id,
      user: log.user,
      task: log.task?.title,
      project: log.task?.project?.name,
      start: log.startTime,
      end: log.endTime,
      link: `/admin/task-timesheet/${log._id}`
    }));

    res.json({ submittedLogs: data });
  } catch (err) {
    console.error("Fetch submitted task timesheets error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createMyTask,
  getAllTasks,
  getAllTasksByUser,
  getTaskById,
  updateTask,
  deleteTask,
  startTaskTimer,
  stopTaskTimer,
  getDailyTaskTimesheet,
  submitTaskTimesheet,
  getSubmittedTaskTimesheets
};