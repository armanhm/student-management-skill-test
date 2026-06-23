const { z } = require("zod");

const idParam = z.object({
    id: z.coerce.number({ invalid_type_error: "Id must be a number" }).int().positive("Id must be a positive integer")
});

// Mirrors the fields the frontend student form submits (see student-schema.ts on the client).
const studentBody = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().min(1, "Email is required"),
    gender: z.string().min(1, "Gender is required"),
    phone: z.string().min(1, "Phone is required"),
    dob: z.string().min(1, "Date of birth is required"),
    class: z.string().min(1, "Class is required"),
    section: z.string().optional(),
    roll: z.coerce.number({ invalid_type_error: "Roll must be a number" })
        .int("Roll must be a whole number")
        .positive("Roll must be a positive number"),
    admissionDate: z.string().min(1, "Admission date is required"),
    currentAddress: z.string().min(1, "Current address is required"),
    permanentAddress: z.string().min(1, "Permanent address is required"),
    fatherName: z.string().min(1, "Father name is required"),
    fatherPhone: z.string().optional(),
    motherName: z.string().optional(),
    motherPhone: z.string().optional(),
    guardianName: z.string().min(1, "Guardian name is required"),
    guardianPhone: z.string().min(1, "Guardian phone is required"),
    relationOfGuardian: z.string().min(1, "Relation of guardian is required"),
    systemAccess: z.boolean().optional()
});

const GetStudentsSchema = z.object({
    query: z.object({
        name: z.string().optional(),
        className: z.string().optional(),
        section: z.string().optional(),
        roll: z.string().optional()
    })
});

const GetStudentDetailSchema = z.object({
    params: idParam
});

const AddStudentSchema = z.object({
    body: studentBody
});

const UpdateStudentSchema = z.object({
    params: idParam,
    body: studentBody
});

const SetStudentStatusSchema = z.object({
    params: idParam,
    body: z.object({
        status: z.boolean({
            required_error: "Status is required",
            invalid_type_error: "Status must be a boolean"
        })
    })
});

module.exports = {
    GetStudentsSchema,
    GetStudentDetailSchema,
    AddStudentSchema,
    UpdateStudentSchema,
    SetStudentStatusSchema
};
