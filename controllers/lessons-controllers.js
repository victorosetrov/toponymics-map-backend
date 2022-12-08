const fs = require('fs');

const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Lesson = require('../models/lesson');
const User = require('../models/user');

const getLessonById = async (req, res, next) => {
  const lessonId = req.params.lid;

  let lesson;
  try {
    lesson = await Lesson.findById(lessonId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not find a lesson.',
      500
    );
    return next(error);
  }

  if (!lesson) {
    const error = new HttpError(
      'Could not find lesson for the provided id.',
      404
    );
    return next(error);
  }

  res.json({ lesson: lesson.toObject({ getters: true }) });
};

const getLessonsByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // let lessons;
  let userWithLessons;
  try {
    userWithLessons = await User.findById(userId).populate('lessons');
  } catch (err) {
    const error = new HttpError(
      'Fetching lessons failed, please try again later.',
      500
    );
    return next(error);
  }

  // if (!lessons || lessons.length === 0) {
  if (!userWithLessons || userWithLessons.lessons.length === 0) {
    return next(
      new HttpError('Could not find lessons for the provided user id.', 404)
    );
  }

  res.json({
    lessons: userWithLessons.lessons.map(lesson =>
      lesson.toObject({ getters: true })
    )
  });
};

const createLesson = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdLesson = new Lesson({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      'Creating lesson failed, please try again.',
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError('Could not find user for provided id.', 404);
    return next(error);
  }

  console.log(user);

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdLesson.save({ session: sess });
    user.lessons.push(createdLesson);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Creating lesson failed, please try again.',
      500
    );
    return next(error);
  }

  res.status(201).json({ lesson: createdLesson });
};

const updateLesson = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { title, description } = req.body;
  const lessonId = req.params.lid;

  let lesson;
  try {
    lesson = await Lesson.findById(lessonId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update lesson.',
      500
    );
    return next(error);
  }

  if (lesson.creator.toString() !== req.userData.userId) {
    const error = new HttpError('You are not allowed to edit this lesson.', 401);
    return next(error);
  }

  lesson.title = title;
  lesson.description = description;

  try {
    await lesson.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update lesson.',
      500
    );
    return next(error);
  }

  res.status(200).json({ lesson: lesson.toObject({ getters: true }) });
};

const deleteLesson = async (req, res, next) => {
  const lessonId = req.params.lid;

  let lesson;
  try {
    lesson = await Lesson.findById(lessonId).populate('creator');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete lesson.',
      500
    );
    return next(error);
  }

  if (!lesson) {
    const error = new HttpError('Could not find lesson for this id.', 404);
    return next(error);
  }

  if (lesson.creator.id !== req.userData.userId) {
    const error = new HttpError(
      'You are not allowed to delete this lesson.',
      401
    );
    return next(error);
  }

  const imagePath = lesson.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await lesson.remove({ session: sess });
    lesson.creator.lessons.pull(lesson);
    await lesson.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete lesson.',
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.status(200).json({ message: 'Deleted lesson.' });
};

exports.getLessonById = getLessonById;
exports.getLessonsByUserId = getLessonsByUserId;
exports.createLesson = createLesson;
exports.updateLesson = updateLesson;
exports.deleteLesson = deleteLesson;
