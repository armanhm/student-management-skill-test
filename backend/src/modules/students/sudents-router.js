const express = require("express");
const router = express.Router();
const studentController = require("./students-controller");
const { validateRequest } = require("../../utils");
const {
    GetStudentsSchema,
    GetStudentDetailSchema,
    AddStudentSchema,
    UpdateStudentSchema,
    SetStudentStatusSchema
} = require("./students-schema");

router.get("", validateRequest(GetStudentsSchema), studentController.handleGetAllStudents);
router.post("", validateRequest(AddStudentSchema), studentController.handleAddStudent);
router.get("/:id", validateRequest(GetStudentDetailSchema), studentController.handleGetStudentDetail);
router.post("/:id/status", validateRequest(SetStudentStatusSchema), studentController.handleStudentStatus);
router.put("/:id", validateRequest(UpdateStudentSchema), studentController.handleUpdateStudent);

module.exports = { studentsRoutes: router };
