const express = require('express');
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateStatus,
} = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/status', updateStatus);

module.exports = router;
