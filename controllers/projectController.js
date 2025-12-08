const ProjectTimeLog = require("../models/ProjectTimeLog");
const Project = require("../models/Project");
const User = require("../models/User");
const MyTask = require("../models/MyTask");
const ProjectAssignedEmail = require("../emails/ProjectAssignedEmail.jsx");
const sendEmail = require("../services/send-email");
const ReactDOMServer = require("react-dom/server");
const NotificationSettings = require("../models/NotificationSettings.js");
const Notifications = require("../models/Notifications.js");
const TimeEntry = require("../models/TimeEntry.js");
const { default: mongoose } = require("mongoose");

const createProject = async (req, res) => {
  const { name, description, teamMembers, deadline } = req.body;

  try {
    if (
      !name ||
      !description ||
      !Array.isArray(teamMembers) ||
      teamMembers.length === 0
    ) {
      return res.status(400).json({
        message:
          "Name, description, and at least one team member ID are required",
      });
    }

    const members = await User.find({
      _id: { $in: teamMembers },
      role: "team",
    });

    if (members.length !== teamMembers.length) {
      return res.status(400).json({
        message: "One or more assigned users are not valid team members",
      });
    }

    const newProject = new Project({
      name,
      description,
      teamMembers: teamMembers.map((userId) => ({
        user: userId,
        status: "pending",
      })),
      createdBy: req.user.id,
      team: req.user.team,
      ...(deadline && { deadline }),
    });

    if (!newProject.teamMembers.some((m) => m.user.toString() === req.user.id)) {
     
      newProject.teamMembers.unshift({ user: req.user.id, status: "accepted" });
    } else {
      
      newProject.teamMembers = newProject.teamMembers.map((m) =>
        m.user.toString() === req.user.id ? { ...m, status: "accepted" } : m
      );
    }

    await newProject.save();

    await Promise.all(
      members.map(async (member) => {
        try {
          const settings = await NotificationSettings.findOne({ user: member._id });

          if (!settings || settings.project_invitation_notification !== false) {
            await Notifications.create({
              recipient: member._id,
              type: "project_invitation",
              message: `You've been added to the project "${newProject.name}".`,
              link: `/projects/${newProject._id}`,
              actions: [
                {
                  label: 'Accept',
                  url: `https://techstahr.onrender.com/api/v1/project/accept-invite/${newProject._id}`,
                },
                {
                  label: 'Reject',
                  url: `https://techstahr.onrender.com/api/v1/project/reject-invite/${newProject._id}`,
                },
              ],
            });
          }

          if (!settings || settings.email_notification !== false) {
            const html = ReactDOMServer.renderToStaticMarkup(
              ProjectAssignedEmail({
                full_name: member.full_name,
                projectName: name,
              })
            );

            await sendEmail({
              to: member.email,
              subject: `You've been added to project "${name}"`,
              html,
            });
          }
        } catch (err) {
          console.error(`Error sending notification to ${member._id}:`, err);
        }
      })
    );

    const populatedProject = await Project.findById(newProject._id)
      .populate("teamMembers.user", "full_name email role")
      .populate("tasks");

    return res.status(201).json({
      message: "Project created successfully",
      project: populatedProject,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({
      message: "Internal server error while creating project",
      error: error.message,
    });
  }
};

const assignTeamMembers = async (req, res) => {
  const { projectId } = req.params;
  const { teamMembers } = req.body;

  if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
    return res
      .status(400)
      .json({ message: "teamMembers must be a non-empty array of user IDs." });
  }

  try {
    const project = await Project.findById(projectId);
    if (!project)
      return res.status(404).json({ message: "Project not found." });

    const existingMemberIds = project.teamMembers.map(m => m.user.toString());

    const newMemberIds = teamMembers.filter(
      id => !existingMemberIds.includes(id.toString())
    );

    if (newMemberIds.length === 0) {
      return res.status(400).json({ message: "All selected users are already assigned to this project." });
    }

    const members = await User.find({
      _id: { $in: newMemberIds },
      role: "team",
    });
    if (members.length !== newMemberIds.length) {
      return res
        .status(400)
        .json({ message: "One or more users are not valid team members." });
    }

    project.teamMembers.push(
      ...newMemberIds.map(id => ({ user: id, status: 'pending' }))
    );
    await project.save();

    for (const member of members) {
      const settings = await NotificationSettings.findOne({ user: member._id });

      if (!settings || settings.project_invitation_notification !== false) {
        await Notifications.create({
          recipient: member._id,
          type: "project_invitation",
          message: `You've been added to the project "${project.name}".`,
          link: `/projects/${project._id}`,
          actions: [
            {
              label: 'Accept',
              url: `https://techstahr.onrender.com/api/v1/project/accept-invite/${project._id}`,
            },
            {
              label: 'Reject',
              url: `https://techstahr.onrender.com/api/v1/project/reject-invite/${project._id}`,
            },
          ],
        });

      }

      if (!settings || settings.email_notification !== false) {
        const html = ReactDOMServer.renderToStaticMarkup(
          ProjectAssignedEmail({
            full_name: member.full_name,
            projectName: project.name,
          })
        );

        await sendEmail({
          to: member.email,
          subject: `You've been added to project "${project.name}"`,
          html,
        });
      }
    }

    const updated = await Project.findById(project._id).populate(
      "teamMembers",
      "full_name email"
    );
    res
      .status(200)
      .json({
        message: "Team members assigned successfully",
        project: updated,
      });
  } catch (error) {
    console.error("Error assigning team members:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const acceptProjectInvite = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.teamMembers.find(
      (m) => m.user.toString() === userId
    );
    if (!member) {
      return res
        .status(403)
        .json({ message: "You are not invited to this project" });
    }

    if (member.status === "accepted") {
      return res.status(400).json({ message: "Invitation already accepted" });
    }

    if (member.status === "declined") {
      return res.status(400).json({ message: "Invitation already declined" });
    }

    member.status = "accepted";
    await project.save();

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const existing = await TimeEntry.findOne({
      user: userId,
      project: projectId,
      date: startOfDay,
    });
    if (!existing) {
      await TimeEntry.create({
        user: userId,
        project: projectId,
        date: startOfDay,
        startTime: new Date(),
      });
    }

    res
      .status(200)
      .json({ message: "Project invitation accepted and clock-in recorded" });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const rejectProjectInvite = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.teamMembers.find(
      (m) => m.user.toString() === userId
    );
    if (!member) {
      return res
        .status(403)
        .json({ message: "You are not invited to this project" });
    }

    if (member.status === "declined") {
      return res.status(400).json({ message: "Invitation already declined" });
    }

    if (member.status === "accepted") {
      return res
        .status(400)
        .json({ message: "You have already accepted this project" });
    }

    member.status = "declined";
    await project.save();

    res
      .status(200)
      .json({ message: "Project invitation declined successfully" });
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeTeamMember = async (req, res) => {
  const { projectId } = req.params;
  const { teamMemberId } = req.body;

  try {
    const project = await Project.findById(projectId);
    if (!project)
      return res.status(404).json({ message: "Project not found." });

    const isMember = project.teamMembers.some(
      (member) => member?.user?.toString() === teamMemberId
    );

    if (!isMember) {
      return res
        .status(400)
        .json({ message: "User is not a team member of this project." });
    }

    project.teamMembers = project.teamMembers.filter(
      (member) => member?.user?.toString() !== teamMemberId
    );

    await project.save();

    const updated = await Project.findById(projectId).populate(
      "teamMembers.user",
      "full_name email"
    );
    res.status(200).json({ message: "Team member removed", project: updated });
  } catch (error) {
    console.error("Error removing team member:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProjectInvitations = async (req, res) => {
  try {
    const userId = req.user.id;

    const invitations = await Project.find({
      "teamMembers.user": userId,
      "teamMembers.status": "pending",
    })
      .select("name description deadline createdBy teamMembers")
      .populate("createdBy", "full_name email")
      .lean();

    const result = invitations.map((project) => {
      const member = project.teamMembers.find(
        (m) => m.user.toString() === userId
      );
      return {
        _id: project._id,
        name: project.name,
        description: project.description,
        deadline: project.deadline,
        invitedBy: project.createdBy,
        status: member?.status || "pending",
      };
    });

    res.status(200).json({ invitations: result });
  } catch (err) {
    console.error("Error fetching invitations:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProjectStats = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [completed, updated, created, dueSoon] = await Promise.all([
      Project.countDocuments({
        status: "completed",
        updatedAt: { $gte: sevenDaysAgo },
      }),
      Project.countDocuments({
        updatedAt: { $gte: sevenDaysAgo },
      }),
      Project.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      }),
      Project.countDocuments({
        deadline: {
          $gte: now,
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    res.status(200).json({
      completed,
      updated,
      created,
      dueSoon,
    });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ team: req.user.team })
      .populate({
        path: "teamMembers.user",
        select: "full_name email role avatar"
      })

      .populate({
        path: "tasks",
        populate: { path: "owner", select: "full_name email" },
      });

    res.status(200).json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const project = await Project.findOne({ _id: id, team: req.user.team })
      .populate({
        path: "teamMembers.user",
        select: "full_name email role avatar"
      })

      .populate({
        path: "tasks",
        populate: { path: "owner", select: "full_name email" },
      });

    if (!project) return res.status(404).json({ message: "Project not found" });

    res.status(200).json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getMyProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    let projects = await Project.find({
      "teamMembers.user": userId,
      team: req.user.team,
    })
      .populate("teamMembers.user", "full_name email role")
      .populate("createdBy", "full_name email")
      .populate("team", "name")
      .sort({ createdAt: -1 });

    projects = await Project.populate(projects, {
      path: "tasks",
    });

    res.status(200).json({
      message: "Projects assigned to user",
      projects,
    });
  } catch (error) {
    console.error("Error fetching user's projects:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateProjectProgress = async (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;

  try {
    if (progress % 10 !== 0 || progress < 0 || progress > 100) {
      return res
        .status(400)
        .json({ message: "Progress must be between 0 and 100 in 10% steps." });
    }

    const updateFields = { progress };
    if (progress === 100) {
      updateFields.status = "completed";
    } else if (progress > 0) {
      updateFields.status = "started";
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, team: req.user.team },
      updateFields,
      { new: true }
    ).populate("teamMembers");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const adminUsers = await User.find({ team: req.user.team, role: "admin" });

    const notifications = adminUsers.map(admin => ({
      recipient: admin._id,
      type: "project_status_updated",
      message: `Progress of project "${project.name}" updated to ${progress}%.${progress === 100 ? ' Project marked as completed.' : ''}`,
      link: `/projects/${project._id}`
    }));

    await Notifications.insertMany(notifications);

    res.status(200).json(project);
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateProjectStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["pending", "active", "started", "completed"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value." });
  }

  try {
    const updateFields = { status };
    if (status === "completed") {
      updateFields.progress = 100;
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, team: req.user.team },
      updateFields,
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const adminUsers = await User.find({ team: req.user.team, role: "admin" });

    const notifications = adminUsers.map(admin => ({
      recipient: admin._id,
      type: "project_status_updated",
      message: `Status of project "${project.name}" updated to "${status}".${status === 'completed' ? ' Progress set to 100%.' : ''}`,
      link: `/projects/${project._id}`
    }));

    await Notifications.insertMany(notifications);

    res.status(200).json({
      message: "Project status updated and admins notified.",
      project
    });

  } catch (error) {
    console.error("Error updating project status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const addProjectIssue = async (req, res) => {
  const { id } = req.params;
  const { title, description, message, priority } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Issue message is required" });
  }

  try {
    const project = await Project.findOne({ _id: id, team: req.user.team });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const newIssue = {
      title,
      description,
      message,
      priority: priority || "medium",
      raisedBy: req.user.id,
      resolved: false,
    };

    project.issues.push(newIssue);
    await project.save();

    const admins = await User.find({ team: req.user.team, role: "admin" });

    const notifications = admins.map(admin => ({
      recipient: admin._id,
      type: "issue_created",
      message: `A new issue was raised in project "${project.name}"`,
      link: `/projects/${project._id}?tab=issues`
    }));

    await Notifications.insertMany(notifications);

    res.status(201).json({ message: "Issue added", issue: newIssue });
  } catch (error) {
    console.error("Error adding issue:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const updateProjectIssue = async (req, res) => {
  const { projectId, issueId } = req.params;
  const { title, description, message, priority, resolved } = req.body;

  try {
    const project = await Project.findOne({
      _id: projectId,
      team: req.user.team,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const issue = project.issues.id(issueId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (title !== undefined) issue.title = title;
    if (description !== undefined) issue.description = description;
    if (message !== undefined) issue.message = message;
    if (priority !== undefined) issue.priority = priority;
    if (resolved !== undefined) issue.resolved = resolved;

    await project.save();

    res.status(200).json({ message: "Issue updated", issue });
  } catch (error) {
    console.error("Error updating issue:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllIssues = async (req, res) => {
  try {
    const projects = await Project.find(
      { team: req.user.team },
      "name issues"
    ).populate("issues.raisedBy", "full_name email");

    const allIssues = projects.flatMap((project) =>
      project.issues.map((issue) => ({
        projectId: project._id,
        projectName: project.name,
        ...issue._doc,
      }))
    );

    res.status(200).json({ issues: allIssues });
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getMyIssues = async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await Project.find(
      { "issues.raisedBy": userId, team: req.user.team },
      "name issues"
    ).populate("issues.raisedBy", "full_name email");

    const myIssues = projects.flatMap((project) =>
      project.issues
        .filter(
          (issue) => issue.raisedBy && issue.raisedBy._id.toString() === userId
        )
        .map((issue) => ({
          projectId: project._id,
          projectName: project.name,
          ...issue._doc,
        }))
    );

    res.status(200).json({ issues: myIssues });
  } catch (error) {
    console.error("Error fetching user issues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllProjectProgress = async (req, res) => {
  try {
    const projects = await Project.find(
      { team: req.user.team },
      "name progress status teamMembers"
    ).populate("teamMembers", "full_name email");

    res.status(200).json({ projects });
  } catch (error) {
    console.error("Error fetching project progress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllProjectMembersInTeam = async (req, res) => {
  try {
    const teamId = req.user.team;

    const projects = await Project.find({ team: teamId }).populate('teamMembers.user', 'full_name email role avatar');

    const membersMap = new Map();

    for (const project of projects) {
      for (const member of project.teamMembers) {
        const user = member.user;
        if (user && user._id) {
          const userId = user._id.toString();

          if (!membersMap.has(userId)) {
            membersMap.set(userId, {
              _id: user._id,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              avatar: user.avatar || null,
              status: member.status || 'unknown'
            });
          }
        }
      }
    }

    const teamMembers = Array.from(membersMap.values());

    res.status(200).json({
      teamMembers
    });

  } catch (error) {
    console.error("Error fetching team project members:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const teamId = req.user.team;

    const project = await Project.findOne({
      _id: projectId,
      team: teamId,
    }).populate("teamMembers.user", "full_name email role");

    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or does not belong to your team" });
    }

    const members = project.teamMembers
      .filter((member) => member.user)
      .map((member) => ({
        _id: member.user._id,
        full_name: member.user.full_name,
        email: member.user.email,
        role: member.user.role,
        avatar: member.user.avatar || null,
        status: member.status || "unknown",
      }));

    res.status(200).json({ teamMembers: members });
  } catch (error) {
    console.error("Error fetching project team members:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const startTimer = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const project = await Project.findOne({
      _id: projectId,
      team: req.user.team,
    });
    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or access denied" });
    }

    const activeLog = await ProjectTimeLog.findOne({
      project: projectId,
      user: userId,
      endTime: null,
    });
    if (activeLog) {
      return res
        .status(400)
        .json({
          message: "Timer is already running for this user on this project",
        });
    }

    const newLog = new ProjectTimeLog({
      project: projectId,
      user: userId,
      startTime: new Date(),
    });

    await newLog.save();

    res.status(201).json({ message: "Timer started", log: newLog });
  } catch (error) {
    console.error("Start timer error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const stopTimer = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const project = await Project.findOne({
      _id: projectId,
      team: req.user.team,
    });
    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or access denied" });
    }

    const log = await ProjectTimeLog.findOne({
      project: projectId,
      user: userId,
      endTime: null,
    });

    if (!log) {
      return res.status(404).json({ message: "No active timer found" });
    }

    const endTime = new Date();
    const duration = Math.round((endTime - log.startTime) / 60000);

    log.endTime = endTime;
    log.durationMinutes = duration;

    await log.save();

    res.status(200).json({ message: "Timer stopped", log });
  } catch (error) {
    console.error("Stop timer error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getDailyTimesheet = async (req, res) => {
  const userTeamId = req.user.team;
  const { date } = req.query;

  try {
    const now = new Date();
    let inputDate;

    if (date) {
      const [year, month, day] = date.split("-").map(Number);
      inputDate = new Date(year, month - 1, day);
    } else {
      inputDate = now;
    }

    const targetDate = new Date(
      inputDate.getFullYear(),
      inputDate.getMonth(),
      inputDate.getDate(),
      0, 0, 0, 0
    );

    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const logs = await ProjectTimeLog.find({
      startTime: { $gte: targetDate, $lt: nextDay }
    })
      .populate({
        path: "project",
        match: { team: userTeamId },
        select: "name"
      })
      .populate({
        path: "user",
        select: "full_name email"
      });

    const timesheet = {};

    for (const log of logs) {
      if (!log.project) continue;

      const projId = log.project._id.toString();

      if (!timesheet[projId]) {
        timesheet[projId] = {
          projectName: log.project.name,
          logs: []
        };
      }

      timesheet[projId].logs.push({
        logId: log._id,
        user: log.user.full_name || log.user.email,
        start: log.startTime,
        end: log.endTime,
        isRunning: !log.endTime,
        link: `/dashboard/team/timesheet/${log._id}`
      });
    }

    res.json({
      date: targetDate.toISOString().split("T")[0],
      timesheet,
      message: "Team daily timesheet fetched successfully",
      queryDate: date || now.toISOString().split("T")[0]
    });
  } catch (error) {
    console.error("Team daily timesheet error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const submitTimesheet = async (req, res) => {
  try {
    const { timeLogId } = req.body;

    const log = await ProjectTimeLog.findOne({
      _id: timeLogId,
      user: req.user.id,
    });

    if (!log) {
      return res.status(404).json({ message: "Time log not found" });
    }

    log.submitted = true;
    await log.save();

    res.json({ message: "Timesheet submitted successfully" });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSubmittedTimesheets = async (req, res) => {
  try {
    const logs = await ProjectTimeLog.find({ submitted: true })
      .populate("user", "full_name email")
      .populate("project", "name");

    const data = await Promise.all(
      logs.map(async (log) => {
        return {
          logId: log._id,
          user: log.user,
          project: log.project,
          start: log.startTime,
          end: log.endTime,
          link: `/admin/timesheet/${log._id}`,
        };
      })
    );

    res.json({ submittedLogs: data });
  } catch (err) {
    console.error("Admin fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteProjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const project = await Project.findOne({ _id: id, team: req.user.team });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (
      project.createdBy.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this project" });
    }

    await MyTask.deleteMany({ project: id });

    await Project.deleteOne({ _id: id });

    res
      .status(200)
      .json({ message: "Project, tasks, and issues deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getDailySummary = async (req, res) => {
  const { teamId, date } = req.params;

  const summaryDate = new Date(date);
  if (isNaN(summaryDate.getTime())) {
    return res
      .status(400)
      .json({ message: "Invalid date format. Use YYYY-MM-DD." });
  }

  const start = new Date(summaryDate.setHours(0, 0, 0, 0));
  const end = new Date(summaryDate.setHours(23, 59, 59, 999));

  try {
    const users = await User.find({ team: teamId, role: "team" }).select(
      "_id full_name email"
    );

    const entries = await TimeEntry.find({
      user: { $in: users.map((u) => u._id) },
      date: { $gte: start, $lte: end },
    }).populate("user", "full_name email");

    const formatHours = (hrs) => {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      return `${h}h ${m}m`;
    };

    const result = users.map((user) => {
      const entry = entries.find(
        (e) => e.user._id.toString() === user._id.toString()
      );

      let total = 0,
        regular = 0,
        overtime = 0;

      if (entry) {
        if (!entry.endTime) {
          const now = new Date();
          const start = new Date(entry.startTime);
          const diffMs = now - start;
          total = diffMs / 1000 / 60 / 60;
        } else {
          total = entry.totalHours || 0;
        }

        regular = Math.min(8, total);
        overtime = Math.max(0, total - 8);
      }

      return {
        user: user.full_name,
        email: user.email,
        hours: {
          total: formatHours(total),
          regular: formatHours(regular),
          overtime: formatHours(overtime),
        },
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error generating daily summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getPendingInvitations = async (req, res) => {
  try {
    const teamId = req.user.team;

    if (!teamId) {
      return res.status(400).json({ message: "Team ID is required." });
    }

    const projects = await Project.find({
      team: teamId,
      "teamMembers.status": "pending"
    })
    .populate("teamMembers.user", "full_name email avatar")
    .populate("createdBy", "full_name email avatar")
    .select("name description teamMembers createdBy");

    const pendingInvitations = projects.map(project => {
      const pendingMembers = project.teamMembers.filter(
        member => member.status === "pending"
      );

      return {
        projectId: project._id,
        projectName: project.name,
        description: project.description,
        createdBy: project.createdBy,
        pendingMembers
      };
    }).filter(entry => entry.pendingMembers.length > 0);

    res.status(200).json({
      message: "Pending invitations fetched successfully.",
      invitations: pendingInvitations
    });
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const addProjectComment = async (req, res) => {
  const { projectId } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Comment text is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const project = await Project.findById(projectId)
      .populate("teamMembers.user", "full_name email")
      .populate("createdBy", "full_name");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.comments.push({
      author: req.user.id,
      text
    });

    await project.save();

    for (const member of project.teamMembers) {
      if (
        member.user &&
        member.user._id.toString() !== req.user.id
      ) {
        const settings = await NotificationSettings.findOne({ user: member.user._id });

        if (!settings || settings.comment_notification !== false) {
          await Notifications.create({
            recipient: member.user._id,
            type: "comment",
            message: `${req.user.full_name || 'A team member'} commented on the project "${project.name}".`,
            link: `/projects/${project._id}`,
          });
        }
      }
    }

    if (
      project.createdBy &&
      project.createdBy._id.toString() !== req.user.id &&
      !project.teamMembers.some(
        tm => tm.user && tm.user._id.toString() === project.createdBy._id.toString()
      )
    ) {
      const creatorSettings = await NotificationSettings.findOne({ user: project.createdBy._id });

      if (!creatorSettings || creatorSettings.comment_notification !== false) {
        await Notifications.create({
          recipient: project.createdBy._id,
          type: "comment",
          message: `${req.user.full_name} commented on your project "${project.name}".`,
          link: `/projects/${project._id}`,
        });
      }
    }

    res.status(200).json({
      message: "Comment added successfully",
      comments: project.comments
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const replyToProjectComment = async (req, res) => {
  const { projectId, commentId } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Reply text is required" });
  }

  try {
    const project = await Project.findById(projectId)
      .populate("comments.author", "full_name email")
      .populate("createdBy", "full_name");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const comment = project.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    comment.replies.push({
      author: req.user.id,
      text,
    });

    await project.save();

    if (comment.author && comment.author._id.toString() !== req.user.id) {
      const settings = await NotificationSettings.findOne({ user: comment.author._id });

      if (!settings || settings.comment_notification !== false) {
        await Notifications.create({
          recipient: comment.author._id,
          type: "comment",
          message: `${req.user.full_name || 'Someone'} replied to your comment on the project "${project.name}".`,
          link: `/projects/${project._id}`,
        });
      }
    }

    res.status(200).json({
      message: "Reply added",
      comment
    });
  } catch (error) {
    console.error("Error replying to comment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProjectComments = async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const project = await Project.findById(projectId)
      .select("comments")
      .populate("comments.author", "full_name email role")
      .populate("comments.replies.author", "full_name email role");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ comments: project.comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const editProject = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const project = await Project.findOne({ _id: id, team: req.user.team });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const allowedUpdates = [
      "name",
      "description",
      "deadline",
      "priority",
      "budget",
      "milestones",
      "tags"
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) project[key] = updates[key];
    });

    await project.save();

    const updatedProject = await Project.findById(id)
      .populate("teamMembers.user", "full_name email role")
      .populate("tasks");

    res.status(200).json({
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateProjectPreferences = async (req, res) => {
  const { id } = req.params;
  const prefs = req.body;

  try {
    const project = await Project.findOne({ _id: id, team: req.user.team });
    if (!project) return res.status(404).json({ message: "Project not found" });

    project.preferences = {
      ...(project.preferences || {}),
      ...(prefs || {})
    };

    await project.save();

    res.status(200).json({
      message: "Project preferences updated",
      preferences: project.preferences,
    });
  } catch (error) {
    console.error("Error updating project preferences:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const manageWorkload = async (req, res) => {
  const { projectId } = req.params;
  const { assignments, redistributeTasks } = req.body;

  try {
    const project = await Project.findOne({ _id: projectId, team: req.user.team }).populate("teamMembers.user");
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Apply explicit assignments
    if (Array.isArray(assignments) && assignments.length > 0) {
      await Promise.all(assignments.map(async (a) => {
        if (!a.taskId) return;
        const update = {};
        if (a.userId) update.assignedTo = a.userId;
        if (a.estimatedHours !== undefined) update.estimatedHours = a.estimatedHours;
        await MyTask.findOneAndUpdate({ _id: a.taskId, project: projectId }, { $set: update });
      }));
    }

    if (redistributeTasks) {
      const members = project.teamMembers
        .filter(m => m.status === 'accepted' && m.user)
        .map(m => m.user._id.toString());

      if (members.length > 0) {
        const unassignedTasks = await MyTask.find({
          project: projectId,
          $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }]
        });

        await Promise.all(unassignedTasks.map((task, idx) => {
          const memberId = members[idx % members.length];
          return MyTask.findByIdAndUpdate(task._id, { $set: { assignedTo: memberId } });
        }));
      }
    }

    const updatedProject = await Project.findById(projectId)
      .populate("teamMembers.user", "full_name email role")
      .populate({
        path: "tasks",
        populate: { path: "owner assignedTo", select: "full_name email" }
      });

    res.status(200).json({
      message: "Workload updated successfully",
      project: updatedProject
    });
  } catch (error) {
    console.error("Error managing workload:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createProject,
  assignTeamMembers,
  removeTeamMember,
  getProjectInvitations,
  getProjectStats,
  getAllProjects,
  getProjectById,
  getMyProjects,
  updateProjectProgress,
  updateProjectStatus,
  addProjectIssue,
  updateProjectIssue,
  getAllIssues,
  getMyIssues,
  getAllProjectProgress,
  getAllProjectMembersInTeam,
  getProjectMembers,
  startTimer,
  stopTimer,
  getDailyTimesheet,
  submitTimesheet,
  getSubmittedTimesheets,
  deleteProjectById,
  getDailySummary,
  acceptProjectInvite,
  rejectProjectInvite,
  getPendingInvitations,
  addProjectComment,
  replyToProjectComment,
  getProjectComments,
  // newly added
  editProject,
  updateProjectPreferences,
  manageWorkload,
};
