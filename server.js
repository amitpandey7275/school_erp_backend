// ----------------------- IMPORTS ----------------------------
require('dotenv').config();
const multer = require("multer");
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ----------------------- SUPABASE CONNECTION ----------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: Supabase ENV variables missing.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ----------------------- MULTER CONFIG ----------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

// ----------------------- REGISTER USER ----------------------------
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        const { error: dbError } = await supabase
            .from("users")
            .insert([{ id: data.user.id, name, email, role, created_at: Date.now() }]);

        if (dbError) return res.status(500).json({ error: dbError.message });

        res.json({ message: "User Registered Successfully!", userId: data.user.id });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- LOGIN ----------------------------
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        res.json({ message: "Login Success", data });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET ROLE ----------------------------
app.post("/get_role", async (req, res) => {
    try {
        const { id } = req.body;

        const { data, error } = await supabase
            .from("users")
            .select("role")
            .eq("id", id)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        res.json({ role: data.role });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- ADD STUDENT ----------------------------
app.post("/add_student", async (req, res) => {
    try {
        const { name, email, password, cls, phone } = req.body;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        const { error: dbError } = await supabase
            .from("users")
            .insert([{ id: data.user.id, name, email, phone, class: cls, role: "student", created_at: Date.now() }]);

        if (dbError) return res.status(500).json({ error: dbError.message });

        res.json({ message: "Student Added Successfully!", userId: data.user.id });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- STUDENT PROFILE ----------------------------
app.get("/get_student_profile", async (req, res) => {
    try {
        const uid = req.query.auth_uid;

        const { data, error } = await supabase
            .from("students")
            .select("*")
            .eq("auth_uid", uid)
            .single();

        if (error) return res.json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPDATE STUDENT PHOTO (FIXED VERSION) ----------------------------
app.post("/update_student_photo", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        const uid = req.body.auth_uid;

        if (!file) return res.json({ error: "Image is required" });

        const fileName = `students/${Date.now()}-${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

        if (uploadError) return res.json({ error: uploadError.message });

        const { data: urlData } = supabase.storage
            .from("student-photos")
            .getPublicUrl(fileName);

        const imageUrl = urlData.publicUrl;

        const { error: updateErr } = await supabase
            .from("students")
            .update({ profile_image_url: imageUrl })
            .eq("auth_uid", uid);

        if (updateErr) return res.json({ error: updateErr.message });

        res.json({ success: true, profile_image_url: imageUrl });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- ADD TEACHER ----------------------------
app.post("/add_teacher", async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        const { error: dbError } = await supabase
            .from("users")
            .insert([{ id: data.user.id, name, email, phone, role: "teacher", created_at: Date.now() }]);

        if (dbError) return res.status(500).json({ error: dbError.message });

        res.json({ message: "Teacher Added Successfully!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- TEACHER PROFILE ----------------------------
app.get("/getTeacherProfile", async (req, res) => {
    try {
        const uid = req.query.uid;

        const { data, error } = await supabase
            .from("teachers")
            .select("*")
            .eq("uid", uid)
            .single();

        if (!data) return res.json({ success: false, message: "Teacher not found" });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------- ADD COMMON USER ----------------------------
app.post("/add_common_user", async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        await supabase
            .from("users")
            .insert([{ id: data.user.id, name, email, phone, role: "common", created_at: Date.now() }]);

        res.json({ message: "Common User Added!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPLOAD EVENT ----------------------------
app.post("/upload_event", upload.single("image"), async (req, res) => {
    try {
        const { title, desc } = req.body;
        const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

        const { error } = await supabase
            .from("events")
            .insert([{ title, description: desc, image: url, time: Date.now() }]);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Event Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPLOAD NOTICE ----------------------------
app.post("/upload_notice", async (req, res) => {
    try {
        const { title, desc } = req.body;

        const { error } = await supabase
            .from("notices")
            .insert([{ title, description: desc, time: Date.now() }]);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Notice Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET NOTICES ----------------------------
app.get("/get_notices", async (req, res) => {
    const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("time", { ascending: false });

    if (error) return res.status(500).json({ error });

    // convert description → desc (as app expects)
    const fixed = data.map(n => ({
        id: n.id,
        title: n.title,
        desc: n.description,
        time: n.time
    }));

    res.json(fixed);
});

// ----------------------- DELETE NOTICE ----------------------------
app.delete("/delete_notice/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await supabase.from("notices").delete().eq("id", id);

        res.json({ message: "Notice Deleted!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPDATE NOTICE ----------------------------
app.put("/update_notice/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, desc } = req.body;

        await supabase
            .from("notices")
            .update({ title, description: desc })
            .eq("id", id);

        res.json({ message: "Notice Updated!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPLOAD NOTES ----------------------------
app.post("/upload_notes", upload.single("pdf"), async (req, res) => {
    try {
        const { title, cls } = req.body;
        const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

        await supabase
            .from("notes")
            .insert([{ class: cls, title, pdfUrl: url, time: Date.now() }]);

        res.json({ message: "Notes Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPLOAD TIMETABLE ----------------------------
app.post("/upload_timetable", upload.single("pdf"), async (req, res) => {
    try {
        const { cls } = req.body;
        const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

        await supabase
            .from("timetable")
            .insert([{ class: cls, pdfUrl: url, time: Date.now() }]);

        res.json({ message: "TimeTable Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- ADMIN UPLOAD GALLERY ----------------------------
app.post("/admin_upload_gallery", upload.array("images", 10), async (req, res) => {
    try {
        if (!req.files.length) {
            return res.status(400).json({ success: false, message: "No images received" });
        }

        let uploadedImages = [];

        for (const file of req.files) {
            const fileName = Date.now() + "_" + file.originalname;

            await supabase.storage
                .from("gallery")
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            const { data: urlData } = supabase.storage
                .from("gallery")
                .getPublicUrl(fileName);

            uploadedImages.push({
                imageUrl: urlData.publicUrl,
                fileName,
                time: Date.now()
            });
        }

        await supabase.from("gallery_images").insert(uploadedImages);

        res.json({ success: true, images: uploadedImages });

    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ----------------------- ADMIN GET GALLERY ----------------------------
app.get("/admin_get_gallery", async (req, res) => {
    try {
        const { data } = await supabase
            .from("gallery_images")
            .select("*")
            .order("time", { ascending: false });

        res.json({ success: true, images: data });

    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ----------------------- ADMIN DELETE GALLERY ----------------------------
app.post("/admin_delete_gallery", async (req, res) => {
    try {
        const { fileName } = req.body;

        await supabase.storage.from("gallery").remove([fileName]);

        await supabase
            .from("gallery_images")
            .delete()
            .eq("fileName", fileName);

        res.json({ success: true, message: "Deleted" });

    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ----------------------- UPLOAD HOMEWORK ----------------------------
app.post("/uploadHomework", async (req, res) => {
    try {
        const { class_name, section, subject, homework_text, teacher_id } = req.body;

        await supabase.from("homework").insert([{
            class_name,
            section,
            subject,
            homework_text,
            teacher_id,
            date: new Date().toISOString().split("T")[0]
        }]);

        res.json({ success: true, message: "Homework uploaded" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET TEACHER HOMEWORK ----------------------------
app.get("/getTeacherHomeworks", async (req, res) => {
    try {
        const { teacher_id, class_name, section } = req.query;

        const { data } = await supabase
            .from("homework")
            .select("*")
            .eq("teacher_id", teacher_id)
            .eq("class_name", class_name)
            .eq("section", section)
            .order("id", { ascending: false });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- UPLOAD CLASSWORK ----------------------------
app.post("/uploadClasswork", upload.single("file"), async (req, res) => {
    try {
        const { title, description, class_name, section_name, subject } = req.body;
        let fileUrl = null;

        if (req.file) {
            const fileName = "classwork/" + Date.now() + "_" + req.file.originalname;

            await supabase.storage
                .from("classwork")
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            const { data: urlData } = supabase.storage
                .from("classwork")
                .getPublicUrl(fileName);

            fileUrl = urlData.publicUrl;
        }

        await supabase.from("classwork").insert([{
            title,
            description,
            class_name,
            section_name,
            subject,
            file_url: fileUrl,
            created_at: new Date()
        }]);

        res.json({ success: true, message: "Classwork Uploaded", fileUrl });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET CLASSWORK ----------------------------
app.get("/getClasswork", async (req, res) => {
    try {
        const { class: className, section } = req.query;

        const { data } = await supabase
            .from("classwork")
            .select("*")
            .eq("class_name", className)
            .eq("section_name", section)
            .order("created_at", { ascending: false });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- TEACHER NOTES UPLOAD ----------------------------
app.post("/teacherUploadNotes", async (req, res) => {
    try {
        const { class_name, subject, title, pdf_url, teacher_id } = req.body;

        await supabase
            .from("TeacherUploadNotes")
            .insert([{ class_name, subject, title, pdf_url, teacher_id }]);

        res.json({ message: "Notes Uploaded" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET TEACHER NOTES ----------------------------
app.get("/getTeacherUploadNotes", async (req, res) => {
    try {
        const { teacher_id } = req.query;

        let query = supabase
            .from("TeacherUploadNotes")
            .select("*")
            .order("created_at", { ascending: false });

        if (teacher_id) query = query.eq("teacher_id", teacher_id);

        const { data } = await query;

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET STUDENTS ----------------------------
app.get("/getStudents", async (req, res) => {
    try {
        const { class_name, section } = req.query;

        let query = supabase
            .from("students")
            .select("*")
            .order("class_name", { ascending: true })
            .order("section", { ascending: true })
            .order("roll_no", { ascending: true });

        if (class_name && class_name !== "ALL") query = query.eq("class_name", class_name);
        if (section && section !== "ALL") query = query.eq("section", section);

        const { data } = await query;

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- TEACHER ATTENDANCE ----------------------------
app.get("/getTeacherAttendanceCalendar", async (req, res) => {
    try {
        const { uid } = req.query;

        const { data } = await supabase
            .from("teacher_attendance")
            .select("*")
            .eq("teacher_uid", uid);

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- ADMIN PROFILE ----------------------------
app.get("/getAdmin", async (req, res) => {
    try {
        const { email } = req.query;

        const { data } = await supabase
            .from("admins")
            .select("*")
            .eq("email", email)
            .single();

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post("/updateAdminProfile", upload.single("image"), async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        let imageUrl = null;

        if (req.file) {
            const ext = req.file.originalname.split(".").pop();
            const fileName = `admin_${Date.now()}.${ext}`;

            await supabase.storage
                .from("admin_images")
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            const { data: urlData } = supabase.storage
                .from("admin_images")
                .getPublicUrl(fileName);

            imageUrl = urlData.publicUrl;
        }

        await supabase
            .from("admins")
            .update({ name, phone, ...(imageUrl && { image: imageUrl }) })
            .eq("email", email);

        res.json({ success: true, message: "Profile Updated!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- START SERVER ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

