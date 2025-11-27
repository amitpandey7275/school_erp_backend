// ----------------------- IMPORTS ----------------------------
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
const supabase = createClient(
    "https://nkgkptxqsrogaiexfuvt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZ2twdHhxc3JvZ2FpZXhmdXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTMxNzEsImV4cCI6MjA3OTI4OTE3MX0.9x2JU_AEApbIYS4477rhk9IhJ-MO-zCMylHFIoqpnXo"
);


// ----------------------- MULTER CONFIG ----------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});


// ----------------------- REGISTER USER ----------------------------
app.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const userId = data.user.id;

    const { error: dbError } = await supabase
        .from("users")
        .insert([{ id: userId, name, email, role, created_at: Date.now() }]);

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ message: "User Registered Successfully!", userId });
});


// ----------------------- LOGIN ----------------------------
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Login Success", data });
});


// ----------------------- GET ROLE ----------------------------
app.post("/get_role", async (req, res) => {
    const { id } = req.body;

    const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", id)
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ role: data.role });
});


// ----------------------- ADD STUDENT ----------------------------
app.post("/add_student", async (req, res) => {
    const { name, email, password, cls, phone } = req.body;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const userId = data.user.id;

    const { error: dbError } = await supabase
        .from("users")
        .insert([{ id: userId, name, email, phone, class: cls, role: "student", created_at: Date.now() }]);

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ message: "Student Added Successfully!", userId });
});


// ----------------------- STUDENT PROFILE ----------------------------
app.get("/get_student_profile", async (req, res) => {
    const uid = req.query.auth_uid;

    const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("auth_uid", uid)
        .single();

    if (error) return res.json({ error: error.message });

    res.json(data);
});


// ----------------------- UPDATE STUDENT PHOTO ----------------------------
app.post("/update_student_photo", upload.single("image"), async (req, res) => {
    const file = req.file;
    const uid = req.body.auth_uid;

    if (!file) return res.json({ error: "Image is required" });

    const fileName = `students/${Date.now()}-${file.originalname}`;

    const { data, error } = await supabase.storage
        .from("student-photos")
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) return res.json({ error: error.message });

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
});


// ----------------------- ADD TEACHER ----------------------------
app.post("/add_teacher", async (req, res) => {
    const { name, email, password, phone } = req.body;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const { error: dbError } = await supabase
        .from("users")
        .insert([{ id: data.user.id, name, email, phone, role: "teacher", created_at: Date.now() }]);

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ message: "Teacher Added Successfully!", userId: data.user.id });
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

        if (error || !data) return res.json({ success: false, message: "Teacher not found" });

        res.json(data);

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});


// ----------------------- ADD COMMON USER ----------------------------
app.post("/add_common_user", async (req, res) => {
    const { name, email, password, phone } = req.body;

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const { error: dbError } = await supabase
        .from("users")
        .insert([{ id: data.user.id, name, email, phone, role: "common", created_at: Date.now() }]);

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ message: "Common User Added!", userId: data.user.id });
});


// ----------------------- UPLOAD EVENT ----------------------------
app.post("/upload_event", upload.single("image"), async (req, res) => {
    const { title, desc } = req.body;
    const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("events")
        .insert([{ title, description: desc, image: url, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Event Uploaded!" });
});


// ----------------------- UPLOAD NOTICE ----------------------------
app.post("/upload_notice", async (req, res) => {
    const { title, desc } = req.body;

    const { error } = await supabase
        .from("notices")
        .insert([{ title, description: desc, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Notice Uploaded!" });
});


// ----------------------- UPLOAD NOTES ----------------------------
app.post("/upload_notes", upload.single("pdf"), async (req, res) => {
    const { title, cls } = req.body;
    const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("notes")
        .insert([{ class: cls, title, pdfUrl: url, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Notes Uploaded!" });
});


// ----------------------- UPLOAD TIMETABLE ----------------------------
app.post("/upload_timetable", upload.single("pdf"), async (req, res) => {
    const { cls } = req.body;
    const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("timetable")
        .insert([{ class: cls, pdfUrl: url, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "TimeTable Uploaded!" });
});


// ----------------------- GET NOTICES ----------------------------
app.get("/get_notices", async (req, res) => {
    const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("time", { ascending: false });

    if (error) return res.status(500).json({ error });

    res.json(data);
});


// ----------------------- UPLOAD GALLERY ----------------------------
app.post("/upload_gallery", upload.array("images", 10), async (req, res) => {
    try {
        if (!req.files?.length) {
            return res.status(400).json({ error: "Images missing" });
        }

        let uploadedImages = [];

        for (const file of req.files) {
            const fileName = Date.now() + "_" + file.originalname;

            const { error: uploadErr } = await supabase.storage
                .from("gallery")
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadErr) return res.status(500).json({ error: uploadErr });

            const { data: urlData } = supabase.storage
                .from("gallery")
                .getPublicUrl(fileName);

            uploadedImages.push({ imageUrl: urlData.publicUrl, time: Date.now() });
        }

        await supabase.from("gallery_images").insert(uploadedImages);

        res.json({ success: true, images: uploadedImages });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


// ----------------------- UPLOAD HOMEWORK ----------------------------
app.post("/uploadHomework", async (req, res) => {
    try {
        const { class_name, subject, homework_text, teacher_id } = req.body;

        const { data, error } = await supabase
            .from("homework")
            .insert([{ class_name, subject, homework_text, teacher_id }]);

        if (error) return res.status(400).json({ error: error.message });

        res.json({ success: true, message: "Homework uploaded", data });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// ----------------------- UPLOAD CLASSWORK ----------------------------
app.post("/uploadClasswork", upload.single("file"), async (req, res) => {
    try {
        const { title, description, class_name, section_name, subject } = req.body;

        let fileUrl = null;


        if (req.file) {
            const fileName = "classwork/" + Date.now() + "_" + req.file.originalname;

            const { error: uploadErr } = await supabase.storage
                .from("classwork")
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (uploadErr) {
                console.log(uploadErr);
                return res.status(500).json({ error: "File upload failed" });
            }

            const { data: urlData } = supabase.storage
                .from("classwork")
                .getPublicUrl(fileName);

            fileUrl = urlData.publicUrl;
        }

        
        const { error } = await supabase
            .from("classwork")
            .insert([{
                title,
                description,
                class_name,
                section_name,
                subject,
                file_url: fileUrl,
                created_at: new Date()  // timestamp thik format me
            }]);

        if (error) {
            console.log(error);
            return res.status(500).json({ error: error.message });
        }

        res.json({
            success: true,
            message: "Classwork Uploaded Successfully",
            fileUrl
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- GET CLASSWORK ----------------------------
app.get("/getClasswork", async (req, res) => {
    try {
        const { class: className, section } = req.query;

        const { data, error } = await supabase
            .from("classwork")
            .select("*")
            .eq("class_name", className)
            .eq("section_name", section)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


// ----------------------- START SERVER ----------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});

