const Task = require('../models/Task');
const mongoose = require('mongoose');

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const allowedStatuses = ['Pending', 'In Progress', 'On hold', 'Review', 'Completed'];
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const priority = (req.body.priority || 'Medium').trim();
    const dueDate = req.body.dueDate;
    const status = (req.body.status || 'Pending').trim();

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    if (!dueDate) {
      return res.status(400).json({ message: 'Due date is required' });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: 'Please enter a valid due date' });
    }

    const task = await Task.create({
      user: req.user._id,
      title,
      description,
      priority,
      dueDate: parsedDueDate,
      status,
    });

    res.status(201).json({ message: 'Task added', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOne({ _id: id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const allowedStatuses = ['Pending', 'In Progress', 'On hold', 'Review', 'Completed'];
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const priority = (req.body.priority || 'Medium').trim();
    const dueDate = req.body.dueDate;
    const status = (req.body.status || 'Pending').trim();

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    if (!dueDate) {
      return res.status(400).json({ message: 'Due date is required' });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: 'Please enter a valid due date' });
    }

    task.title = title;
    task.description = description;
    task.priority = priority;
    task.dueDate = parsedDueDate;
    task.status = status;

    await task.save();
    res.status(200).json({ message: 'Task updated', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOneAndDelete({ _id: id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete task' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOne({ _id: id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
    await task.save();

    res.status(200).json({ message: 'Task status updated', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update task status' });
  }
};
