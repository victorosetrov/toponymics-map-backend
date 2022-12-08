const express = require('express');
const { check } = require('express-validator');

const lessonsControllers = require('../controllers/lessons-controllers');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();

router.get('/:lid', lessonsControllers.getLessonById);

router.get('/user/:uid', lessonsControllers.getLessonsByUserId);

router.use(checkAuth);

router.post(
  '/',
  fileUpload.single('image'),
  [
    check('title')
      .not()
      .isEmpty(),
    check('description').isLength({ min: 5 }),
    check('address')
      .not()
      .isEmpty()
  ],
  lessonsControllers.createLesson
);

router.patch(
  '/:lid',
  [
    check('title')
      .not()
      .isEmpty(),
    check('description').isLength({ min: 5 })
  ],
  lessonsControllers.updateLesson
);

router.delete('/:lid', lessonsControllers.deleteLesson);

module.exports = router;
